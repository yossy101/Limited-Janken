import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  room_id: z.string().uuid()
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

  const { room_id } = parsed.data;
  const supabase = createServiceClient();

  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, assets:player_assets(stars, cash, loan)")
    .eq("room_id", room_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const penalties = [] as { room_id: string; player_id: string; reason: string }[];

  for (const player of players ?? []) {
    const assets = Array.isArray(player.assets) ? player.assets[0] : player.assets;
    if (!assets) continue;
    if ((assets.stars ?? 0) <= 0) {
      penalties.push({ room_id, player_id: player.id, reason: "星が尽きました" });
    }
    if (Number(assets.cash ?? 0) < Number(assets.loan ?? 0)) {
      penalties.push({ room_id, player_id: player.id, reason: "貸付金を返済できませんでした" });
    }
  }

  if (penalties.length > 0) {
    await supabase.from("penalties").insert(penalties);
    await supabase.from("events").insert(
      penalties.map((penalty) => ({
        room_id,
        message: `ペナルティ: プレイヤー ${penalty.player_id} - ${penalty.reason}`
      }))
    );
  }

  return new Response(JSON.stringify({ penalties: penalties.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
