import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { createServiceClient } from "./_shared/supabaseClient.ts";
import { judgeRound, Hand } from "../shared/game/engine.ts";

const schema = z.object({
  match_id: z.string().uuid()
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

  const { match_id } = parsed.data;
  const supabase = createServiceClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, room_id, challenger_id, opponent_id, status, challenger:challenger_id(name), opponent:opponent_id(name)")
    .eq("id", match_id)
    .single();

  if (matchError || !match) {
    return new Response(JSON.stringify({ error: matchError?.message ?? "Match not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: setMoves, error: setError } = await supabase
    .from("match_moves")
    .select("player_id, hand")
    .eq("match_id", match_id)
    .eq("phase", "set");

  if (setError) {
    return new Response(JSON.stringify({ error: setError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: openMoves, error: openError } = await supabase
    .from("match_moves")
    .select("player_id")
    .eq("match_id", match_id)
    .eq("phase", "open");

  if (openError) {
    return new Response(JSON.stringify({ error: openError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!setMoves || setMoves.length < 2) {
    return new Response(JSON.stringify({ error: "Both players must set a card" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const openPlayerIds = new Set(openMoves?.map((move) => move.player_id) ?? []);
  if (!openPlayerIds.has(match.challenger_id) || !openPlayerIds.has(match.opponent_id)) {
    return new Response(JSON.stringify({ error: "両者がオープンする必要があります" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const challengerMove = setMoves.find((move) => move.player_id === match.challenger_id);
  const opponentMove = setMoves.find((move) => move.player_id === match.opponent_id);

  if (!challengerMove || !opponentMove) {
    return new Response(JSON.stringify({ error: "セット情報が不足しています" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const challengerHand = challengerMove.hand as Hand;
  const opponentHand = opponentMove.hand as Hand;
  const result = judgeRound({ playerId: match.challenger_id, hand: challengerHand }, { playerId: match.opponent_id, hand: opponentHand });

  const updates: Promise<unknown>[] = [];
  let message = `${match.challenger?.name ?? "挑戦者"}(${challengerHand}) vs ${match.opponent?.name ?? "相手"}(${opponentHand}) はあいこでした。`;

  if (result.winner && result.loser) {
    const winnerId = result.winner;
    const loserId = result.loser;

    const { data: winnerAsset } = await supabase
      .from("player_assets")
      .select("stars")
      .eq("player_id", winnerId)
      .single();

    const { data: loserAsset } = await supabase
      .from("player_assets")
      .select("stars")
      .eq("player_id", loserId)
      .single();

    if (winnerAsset && loserAsset && loserAsset.stars > 0) {
      updates.push(
        supabase
          .from("player_assets")
          .update({ stars: (winnerAsset.stars ?? 0) + 1, updated_at: new Date().toISOString() })
          .eq("player_id", winnerId)
      );
      updates.push(
        supabase
          .from("player_assets")
          .update({ stars: Math.max(0, (loserAsset.stars ?? 0) - 1), updated_at: new Date().toISOString() })
          .eq("player_id", loserId)
      );
      updates.push(
        supabase
          .from("star_transfers")
          .insert({ room_id: match.room_id, from_player: loserId, to_player: winnerId, amount: 1 })
      );
      message = `${match.challenger?.name ?? "挑戦者"}(${challengerHand}) と ${match.opponent?.name ?? "相手"}(${opponentHand}) の勝者は ${(winnerId === match.challenger_id ? match.challenger?.name : match.opponent?.name) ?? ""} です。`;
    }
  }

  updates.push(
    supabase
      .from("matches")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", match_id)
  );

  updates.push(
    supabase
      .from("used_card_logs")
      .insert([
        { player_id: match.challenger_id, match_id, hand: challengerHand },
        { player_id: match.opponent_id, match_id, hand: opponentHand }
      ])
  );

  updates.push(
    supabase
      .from("events")
      .insert({ room_id: match.room_id, message })
  );

  await Promise.all(updates);

  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
