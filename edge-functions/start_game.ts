import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  room_id: z.string().uuid(),
  time_limit_seconds: z.number().int().min(60),
  loan_amount: z.number().min(0)
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createServiceClient();
  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { room_id, time_limit_seconds, loan_amount } = parsed.data;
  const endAt = new Date(Date.now() + time_limit_seconds * 1000).toISOString();

  const { error: updateRoomError } = await supabase
    .from("rooms")
    .update({ status: "running", running: true, end_at: endAt })
    .eq("id", room_id);

  if (updateRoomError) {
    return new Response(JSON.stringify({ error: updateRoomError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room_id);

  if (playersError) {
    return new Response(JSON.stringify({ error: playersError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (players && players.length > 0) {
    const updates = players.map((player) =>
      supabase
        .from("player_assets")
        .upsert({
          player_id: player.id,
          stars: 3,
          rock: 4,
          paper: 4,
          scissors: 4,
          cash: loan_amount,
          loan: loan_amount,
          updated_at: new Date().toISOString()
        }, { onConflict: "player_id" })
    );
    await Promise.all(updates);
  }

  await supabase.from("events").insert({
    room_id,
    message: `ゲームが開始されました。制限時間は${time_limit_seconds}秒です。`
  });

  return new Response(JSON.stringify({ end_at: endAt }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
