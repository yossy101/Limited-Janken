import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  offer_id: z.string().uuid(),
  actor_id: z.string().uuid()
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createServiceClient();
  const { offer_id, actor_id } = parsed.data;

  const { data: offer, error } = await supabase
    .from("trade_offers")
    .select("room_id, status, maker_id, taker_id, maker:maker_id(name), taker:taker_id(name)")
    .eq("id", offer_id)
    .single();

  if (error || !offer) {
    return new Response(JSON.stringify({ error: error?.message ?? "Offer not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (![offer.maker_id, offer.taker_id].includes(actor_id)) {
    return new Response(JSON.stringify({ error: "キャンセル権限がありません" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { error: updateError } = await supabase
    .from("trade_offers")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", offer_id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  await supabase.from("events").insert({
    room_id: offer.room_id,
    message: `${offer.maker?.name ?? "プレイヤー"} のオファーはキャンセルされました。`
  });

  return new Response(JSON.stringify({ status: "cancelled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
