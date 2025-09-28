import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  challenger_id: z.string().uuid(),
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

  const { challenger_id, opponent_id } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const challenger = await selectOne<{ room_id: string; name: string }>(
        client,
        "select room_id, name from players where id = $1 for update",
        [challenger_id]
      );
      const opponent = await selectOne<{ room_id: string; name: string }>(
        client,
        "select room_id, name from players where id = $1 for update",
        [opponent_id]
      );

      if (!challenger || !opponent) {
        throw new Error("Player not found");
      }
      if (challenger.room_id !== opponent.room_id) {
        throw new Error("Players are not in the same room");
      }

      const inserted = await client.queryObject<{ id: string }>(
        {
          text:
            "insert into matches (room_id, challenger_id, opponent_id, status, created_at) values ($1, $2, $3, 'proposed', $4) returning *",
          args: [challenger.room_id, challenger_id, opponent_id, nowIso()]
        }
      );

      const match = inserted.rows[0];
      if (!match) {
        throw new Error("Failed to create match");
      }

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [
          challenger.room_id,
          `${challenger.name} が ${opponent.name} に挑戦状を送りました。`,
          nowIso()
        ]
      });

      return { match };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Player not found" ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
