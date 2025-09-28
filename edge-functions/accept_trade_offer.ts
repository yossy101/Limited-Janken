import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  offer_id: z.string().uuid(),
  taker_id: z.string().uuid()
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

  const { offer_id, taker_id } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const offer = await selectOne<{
        room_id: string;
        status: string;
        taker_id: string | null;
        maker_id: string;
        maker_name: string | null;
      }>(
        client,
        `select t.room_id, t.status, t.taker_id, t.maker_id, p.name as maker_name
         from trade_offers t
         join players p on p.id = t.maker_id
         where t.id = $1
         for update`,
        [offer_id]
      );

      if (!offer) {
        throw new Error("Offer not found");
      }
      if (offer.status !== "open") {
        throw new Error("Offer is not open");
      }
      if (offer.taker_id && offer.taker_id !== taker_id) {
        throw new Error("Offer reserved for another player");
      }

      const taker = await selectOne<{ room_id: string; name: string }>(
        client,
        "select room_id, name from players where id = $1 for update",
        [taker_id]
      );
      if (!taker || taker.room_id !== offer.room_id) {
        throw new Error("Taker must belong to the same room");
      }

      await client.queryObject({
        text: "update trade_offers set status = 'accepted', taker_id = $1, updated_at = $2 where id = $3",
        args: [taker_id, nowIso(), offer_id]
      });

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [offer.room_id, `${offer.maker_name ?? "プレイヤー"} のオファーが受諾されました。`, nowIso()]
      });
    });

    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    let status = 500;
    if (message === "Offer not found") status = 404;
    else if (message === "Offer is not open" || message === "Offer reserved for another player" || message === "Taker must belong to the same room") {
      status = 400;
    }
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
