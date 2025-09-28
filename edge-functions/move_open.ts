import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, nowIso } from "./_shared/db.ts";

const schema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid()
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

  const { match_id, player_id } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const setMove = await client.queryObject({
        text: "select 1 from match_moves where match_id = $1 and player_id = $2 and phase = 'set' for update",
        args: [match_id, player_id]
      });
      if (setMove.rows.length === 0) {
        throw new Error("セットが完了していません");
      }

      await client.queryObject({
        text: "delete from match_moves where match_id = $1 and player_id = $2 and phase = 'open'",
        args: [match_id, player_id]
      });

      await client.queryObject({
        text: "insert into match_moves (match_id, player_id, phase, created_at) values ($1, $2, 'open', $3)",
        args: [match_id, player_id, nowIso()]
      });
    });

    return new Response(JSON.stringify({ status: "open" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "セットが完了していません" ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
