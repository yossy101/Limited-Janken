import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid()
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
  const { match_id, player_id } = parsed.data;

  const { data: hasSet } = await supabase
    .from("match_moves")
    .select("id")
    .eq("match_id", match_id)
    .eq("player_id", player_id)
    .eq("phase", "set")
    .maybeSingle();

  if (!hasSet) {
    return new Response(JSON.stringify({ error: "セットが完了していません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { error } = await supabase
    .from("match_moves")
    .insert({ match_id, player_id, phase: "open" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ status: "open" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
