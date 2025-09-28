import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectMany, nowIso } from "./_shared/db.ts";

const schema = z.object({
  room_id: z.string().uuid()
});

type PlayerAssetRow = {
  id: string;
  name: string;
  stars: number;
  cash: number;
  loan: number;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { room_id } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const players = await selectMany<PlayerAssetRow>(
        client,
        `select p.id, p.name, a.stars, a.cash, a.loan
         from players p
         join player_assets a on a.player_id = p.id
         where p.room_id = $1
         for update`,
        [room_id]
      );

      const penalties: { room_id: string; player_id: string; reason: string }[] = [];

      for (const player of players) {
        if ((player.stars ?? 0) <= 0) {
          penalties.push({ room_id, player_id: player.id, reason: "星が尽きました" });
        }
        if (Number(player.cash ?? 0) < Number(player.loan ?? 0)) {
          penalties.push({ room_id, player_id: player.id, reason: "貸付金を返済できませんでした" });
        }
      }

      for (const penalty of penalties) {
        await client.queryObject({
          text: "insert into penalties (room_id, player_id, reason, created_at) values ($1, $2, $3, $4)",
          args: [penalty.room_id, penalty.player_id, penalty.reason, nowIso()]
        });
        await client.queryObject({
          text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
          args: [room_id, `ペナルティ: プレイヤー ${penalty.player_id} - ${penalty.reason}`, nowIso()]
        });
      }

      return { penalties: penalties.length };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
