import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

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

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createServiceClient();
  const { maker_id, taker_id, give_json, take_json } = parsed.data;

  const { data: maker, error: makerError } = await supabase
    .from("players")
    .select("room_id, name")
    .eq("id", maker_id)
    .single();

  if (makerError || !maker) {
    return new Response(JSON.stringify({ error: makerError?.message ?? "Maker not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: offer, error } = await supabase
    .from("trade_offers")
    .insert({ room_id: maker.room_id, maker_id, taker_id, give_json, take_json })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  await supabase.from("events").insert({
    room_id: maker.room_id,
    message: `${maker.name} がトレードオファーを作成しました。`
  });

  return new Response(JSON.stringify({ offer }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
