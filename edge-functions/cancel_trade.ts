import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, nowIso } from "./_shared/db.ts";

const schema = z.object({
  offer_id: z.string().uuid(),
  actor_id: z.string().uuid()
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

  const { offer_id, actor_id } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const offer = await selectOne<{
        room_id: string;
        status: string;
        maker_id: string;
        taker_id: string | null;
        maker_name: string | null;
      }>(
        client,
        `select t.room_id, t.status, t.maker_id, t.taker_id, maker.name as maker_name
         from trade_offers t
         join players maker on maker.id = t.maker_id
         where t.id = $1
         for update`,
        [offer_id]
      );

      if (!offer) {
        throw new Error("Offer not found");
      }
      const authorized = offer.maker_id === actor_id || (offer.taker_id != null && offer.taker_id === actor_id);
      if (!authorized) {
        throw new Error("キャンセル権限がありません");
      }

      await client.queryObject({
        text: "update trade_offers set status = 'cancelled', updated_at = $1 where id = $2",
        args: [nowIso(), offer_id]
      });

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [offer.room_id, `${offer.maker_name ?? "プレイヤー"} のオファーはキャンセルされました。`, nowIso()]
      });
    });

    return new Response(JSON.stringify({ status: "cancelled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    let status = 500;
    if (message === "Offer not found") status = 404;
    else if (message === "キャンセル権限がありません") status = 403;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
