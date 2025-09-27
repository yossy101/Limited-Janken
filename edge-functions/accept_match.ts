import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  match_id: z.string().uuid(),
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
  const { match_id, opponent_id } = parsed.data;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("room_id, opponent_id, challenger:challenger_id(name), opponent:opponent_id(name)")
    .eq("id", match_id)
    .single();

  if (matchError || !match) {
    return new Response(JSON.stringify({ error: matchError?.message ?? "Match not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (match.opponent_id !== opponent_id) {
    return new Response(JSON.stringify({ error: "Only the invited opponent can accept" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { error } = await supabase
    .from("matches")
    .update({ status: "accepted" })
    .eq("id", match_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  await supabase.from("events").insert({
    room_id: match.room_id,
    message: `${match.opponent?.name ?? "対戦相手"} が ${match.challenger?.name ?? "挑戦者"} の挑戦を受けました。`
  });

  return new Response(JSON.stringify({ status: "accepted" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
