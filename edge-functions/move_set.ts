import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid(),
  hand: z.enum(["rock", "paper", "scissors"])
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
  const { match_id, player_id, hand } = parsed.data;

  const { data: asset, error: assetError } = await supabase
    .from("player_assets")
    .select("id, rock, paper, scissors")
    .eq("player_id", player_id)
    .single();

  if (assetError || !asset) {
    return new Response(JSON.stringify({ error: assetError?.message ?? "Asset not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const handColumn = hand === "rock" ? "rock" : hand === "paper" ? "paper" : "scissors";
  if (asset[handColumn] <= 0) {
    return new Response(JSON.stringify({ error: "カード在庫が不足しています" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const updatePayload: Record<string, number | string> = {
    [handColumn]: asset[handColumn] - 1,
    updated_at: new Date().toISOString()
  };

  const { error: updateError } = await supabase
    .from("player_assets")
    .update(updatePayload)
    .eq("player_id", player_id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { error: insertError } = await supabase
    .from("match_moves")
    .insert({ match_id, player_id, phase: "set", hand });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ status: "set" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
