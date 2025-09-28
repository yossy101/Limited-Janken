import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectMany, nowIso } from "./_shared/db.ts";

const schema = z.object({
  room_id: z.string().uuid(),
  time_limit_seconds: z.number().int().min(60),
  loan_amount: z.number().min(0)
});

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

  const { room_id, time_limit_seconds, loan_amount } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const endAt = new Date(Date.now() + time_limit_seconds * 1000).toISOString();

      const roomResult = await client.queryObject({
        text: "select id from rooms where id = $1 for update",
        args: [room_id]
      });
      if (roomResult.rows.length === 0) {
        throw new Error("Room not found");
      }

      await client.queryObject({
        text: "update rooms set status = 'running', running = true, end_at = $1 where id = $2",
        args: [endAt, room_id]
      });

      const players = await selectMany<{ id: string }>(
        client,
        "select id from players where room_id = $1 for update",
        [room_id]
      );

      for (const player of players) {
        await client.queryObject({
          text:
            "insert into player_assets (player_id, stars, rock, paper, scissors, cash, loan, updated_at) values ($1, 3, 4, 4, 4, $2, $2, $3) " +
            "on conflict (player_id) do update set stars = excluded.stars, rock = excluded.rock, paper = excluded.paper, scissors = excluded.scissors, cash = excluded.cash, loan = excluded.loan, updated_at = excluded.updated_at",
          args: [player.id, loan_amount, nowIso()]
        });
      }

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [room_id, `ゲームが開始されました。制限時間は${time_limit_seconds}秒です。`, nowIso()]
      });

      return { end_at: endAt };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Room not found" ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
