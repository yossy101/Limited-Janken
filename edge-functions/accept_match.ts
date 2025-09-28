import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  match_id: z.string().uuid(),
  opponent_id: z.string().uuid()
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

  const { match_id, opponent_id } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const match = await selectOne<{
        room_id: string;
        opponent_id: string;
        challenger_id: string;
      }>(
        client,
        "select room_id, opponent_id, challenger_id from matches where id = $1 for update",
        [match_id]
      );

      if (!match) {
        throw new Error("Match not found");
      }
      if (match.opponent_id !== opponent_id) {
        throw new Error("Only the invited opponent can accept");
      }

      await client.queryObject({
        text: "update matches set status = 'accepted' where id = $1",
        args: [match_id]
      });

      const challenger = await selectOne<{ name: string }>(
        client,
        "select name from players where id = $1",
        [match.challenger_id]
      );
      const opponent = await selectOne<{ name: string }>(
        client,
        "select name from players where id = $1",
        [opponent_id]
      );

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [
          match.room_id,
          `${opponent?.name ?? "対戦相手"} が ${challenger?.name ?? "挑戦者"} の挑戦を受けました。`,
          nowIso()
        ]
      });
    });

    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Match not found" ? 404 : message === "Only the invited opponent can accept" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
