import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid(),
  hand: z.enum(["rock", "paper", "scissors"])
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

  const { match_id, player_id, hand } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const asset = await selectOne<{ rock: number; paper: number; scissors: number }>(
        client,
        "select rock, paper, scissors from player_assets where player_id = $1 for update",
        [player_id]
      );
      if (!asset) {
        throw new Error("Asset not found");
      }

      const handColumn = hand === "rock" ? "rock" : hand === "paper" ? "paper" : "scissors";
      if ((asset as Record<string, number>)[handColumn] <= 0) {
        throw new Error("カード在庫が不足しています");
      }

      await client.queryObject({
        text: `update player_assets set ${handColumn} = ${handColumn} - 1, updated_at = $1 where player_id = $2`,
        args: [nowIso(), player_id]
      });

      await client.queryObject({
        text: "delete from match_moves where match_id = $1 and player_id = $2 and phase = 'set'",
        args: [match_id, player_id]
      });

      await client.queryObject({
        text: "insert into match_moves (match_id, player_id, phase, hand, created_at) values ($1, $2, 'set', $3, $4)",
        args: [match_id, player_id, hand, nowIso()]
      });
    });

    return new Response(JSON.stringify({ status: "set" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Asset not found" ? 404 : message === "カード在庫が不足しています" ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
