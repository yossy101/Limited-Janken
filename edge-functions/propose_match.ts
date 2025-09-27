import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  challenger_id: z.string().uuid(),
  opponent_id: z.string().uuid()
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
  const { challenger_id, opponent_id } = parsed.data;

  const { data: challenger } = await supabase
    .from("players")
    .select("room_id, name")
    .eq("id", challenger_id)
    .single();

  const { data: opponent } = await supabase
    .from("players")
    .select("room_id, name")
    .eq("id", opponent_id)
    .single();

  if (!challenger || !opponent || challenger.room_id !== opponent.room_id) {
    return new Response(JSON.stringify({ error: "Players are not in the same room" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      room_id: challenger.room_id,
      challenger_id,
      opponent_id,
      status: "proposed"
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  await supabase.from("events").insert({
    room_id: challenger.room_id,
    message: `${challenger.name} が ${opponent.name} に挑戦状を送りました。`
  });

  return new Response(JSON.stringify({ match }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
