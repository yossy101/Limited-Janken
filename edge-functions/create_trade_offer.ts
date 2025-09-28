import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  maker_id: z.string().uuid(),
  taker_id: z.string().uuid().optional(),
  give_json: z.record(z.string(), z.any()),
  take_json: z.record(z.string(), z.any())
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

  const { maker_id, taker_id, give_json, take_json } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const maker = await selectOne<{ room_id: string; name: string }>(
        client,
        "select room_id, name from players where id = $1 for update",
        [maker_id]
      );
      if (!maker) {
        throw new Error("Maker not found");
      }

      if (taker_id) {
        const taker = await selectOne<{ room_id: string }>(
          client,
          "select room_id from players where id = $1 for update",
          [taker_id]
        );
        if (!taker || taker.room_id !== maker.room_id) {
          throw new Error("Taker must belong to the same room");
        }
      }

      const inserted = await client.queryObject({
        text:
          "insert into trade_offers (room_id, maker_id, taker_id, give_json, take_json, created_at, updated_at) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $6) returning *",
        args: [maker.room_id, maker_id, taker_id ?? null, JSON.stringify(give_json), JSON.stringify(take_json), nowIso()]
      });

      const offer = inserted.rows[0];
      if (!offer) {
        throw new Error("Failed to create offer");
      }

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [maker.room_id, `${maker.name} がトレードオファーを作成しました。`, nowIso()]
      });

      return { offer };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Maker not found" ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
