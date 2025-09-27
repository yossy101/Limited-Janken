import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";

const schema = z.object({
  offer_id: z.string().uuid()
});

type AssetShape = {
  stars?: number;
  rock?: number;
  paper?: number;
  scissors?: number;
  cash?: number;
};

const allowedKeys = ["stars", "rock", "paper", "scissors", "cash"] as const;

const normalizeAssets = (value: unknown): AssetShape => {
  if (!value || typeof value !== "object") return {};
  const result: AssetShape = {};
  for (const key of allowedKeys) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    result[key] = num;
  }
  return result;
};

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
  const { offer_id } = parsed.data;

  const { data: offer, error: offerError } = await supabase
    .from("trade_offers")
    .select("id, room_id, status, maker_id, taker_id, give_json, take_json, maker:maker_id(name), taker:taker_id(name)")
    .eq("id", offer_id)
    .single();

  if (offerError || !offer) {
    return new Response(JSON.stringify({ error: offerError?.message ?? "Offer not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!offer.taker_id) {
    return new Response(JSON.stringify({ error: "取引相手が未設定です" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (offer.status !== "accepted") {
    return new Response(JSON.stringify({ error: "オファーが受諾状態ではありません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const give = normalizeAssets(offer.give_json);
  const take = normalizeAssets(offer.take_json);

  const { data: makerAssets, error: makerAssetsError } = await supabase
    .from("player_assets")
    .select("stars, rock, paper, scissors, cash")
    .eq("player_id", offer.maker_id)
    .single();

  const { data: takerAssets, error: takerAssetsError } = await supabase
    .from("player_assets")
    .select("stars, rock, paper, scissors, cash")
    .eq("player_id", offer.taker_id)
    .single();

  if (makerAssetsError || takerAssetsError || !makerAssets || !takerAssets) {
    return new Response(JSON.stringify({ error: makerAssetsError?.message ?? takerAssetsError?.message ?? "資産取得に失敗しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const nextMaker: AssetShape = { ...makerAssets };
  const nextTaker: AssetShape = { ...takerAssets };

  for (const key of allowedKeys) {
    const giveValue = give[key] ?? 0;
    const takeValue = take[key] ?? 0;
    const makerNext = (nextMaker[key] ?? 0) - giveValue + takeValue;
    const takerNext = (nextTaker[key] ?? 0) + giveValue - takeValue;
    if (makerNext < 0 || takerNext < 0) {
      return new Response(JSON.stringify({ error: "資産がマイナスになります" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    nextMaker[key] = makerNext;
    nextTaker[key] = takerNext;
  }

  const updates = [
    supabase
      .from("player_assets")
      .update({ ...nextMaker, updated_at: new Date().toISOString() })
      .eq("player_id", offer.maker_id),
    supabase
      .from("player_assets")
      .update({ ...nextTaker, updated_at: new Date().toISOString() })
      .eq("player_id", offer.taker_id)
  ];

  updates.push(
    supabase
      .from("trade_offers")
      .update({ status: "settled", updated_at: new Date().toISOString() })
      .eq("id", offer_id)
  );

  const starTransfers: { from_player: string; to_player: string; amount: number }[] = [];
  const starDelta = (give.stars ?? 0) - (take.stars ?? 0);
  if (starDelta > 0) {
    starTransfers.push({ from_player: offer.maker_id, to_player: offer.taker_id, amount: starDelta });
  } else if (starDelta < 0) {
    starTransfers.push({ from_player: offer.taker_id, to_player: offer.maker_id, amount: Math.abs(starDelta) });
  }

  if (starTransfers.length > 0) {
    updates.push(
      supabase
        .from("star_transfers")
        .insert(starTransfers.map((transfer) => ({ ...transfer, room_id: offer.room_id })))
    );
  }

  updates.push(
    supabase
      .from("events")
      .insert({
        room_id: offer.room_id,
        message: `${offer.maker?.name ?? "プレイヤー"} と ${offer.taker?.name ?? "相手"} の取引が成立しました。`
      })
  );

  await Promise.all(updates);

  return new Response(JSON.stringify({ status: "settled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
