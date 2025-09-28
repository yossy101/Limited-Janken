import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { z } from "npm:zod";
import { withTransaction, selectOne, selectMany, nowIso } from "./_shared/db.ts";
import { planResolution } from "./_shared/logic/resolveMatch.ts";
import type { Hand } from "../shared/game/engine.ts";

const schema = z.object({
  match_id: z.string().uuid()
});

type MatchRow = {
  id: string;
  room_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_name: string | null;
  opponent_name: string | null;
};

type MoveRow = {
  player_id: string;
  hand: string;
};

type AssetRow = {
  player_id: string;
  stars: number;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { match_id } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const match = await selectOne<MatchRow>(
        client,
        `select m.id, m.room_id, m.challenger_id, m.opponent_id, c.name as challenger_name, o.name as opponent_name
         from matches m
         join players c on c.id = m.challenger_id
         join players o on o.id = m.opponent_id
         where m.id = $1
         for update`,
        [match_id]
      );

      if (!match) {
        throw new Error("Match not found");
      }

      const setMoves = await selectMany<MoveRow>(
        client,
        "select player_id, hand from match_moves where match_id = $1 and phase = 'set'",
        [match_id]
      );
      if (setMoves.length < 2) {
        throw new Error("Both players must set a card");
      }

      const openMoves = await selectMany<{ player_id: string }>(
        client,
        "select player_id from match_moves where match_id = $1 and phase = 'open'",
        [match_id]
      );
      const openSet = new Set(openMoves.map((row) => row.player_id));
      if (!openSet.has(match.challenger_id) || !openSet.has(match.opponent_id)) {
        throw new Error("両者がオープンする必要があります");
      }

      const challengerMove = setMoves.find((move) => move.player_id === match.challenger_id);
      const opponentMove = setMoves.find((move) => move.player_id === match.opponent_id);
      if (!challengerMove || !opponentMove) {
        throw new Error("セット情報が不足しています");
      }

      const assets = await selectMany<AssetRow>(
        client,
        "select player_id, stars from player_assets where player_id in ($1, $2) for update",
        [match.challenger_id, match.opponent_id]
      );
      const challengerAsset = assets.find((asset) => asset.player_id === match.challenger_id) ?? null;
      const opponentAsset = assets.find((asset) => asset.player_id === match.opponent_id) ?? null;

      const plan = planResolution(
        {
          challengerId: match.challenger_id,
          opponentId: match.opponent_id,
          roomId: match.room_id,
          challengerName: match.challenger_name,
          opponentName: match.opponent_name
        },
        { player_id: challengerMove.player_id, hand: challengerMove.hand as Hand },
        { player_id: opponentMove.player_id, hand: opponentMove.hand as Hand },
        challengerAsset,
        opponentAsset
      );

      let shouldTransfer = plan.shouldTransferStar;
      if (shouldTransfer && plan.winnerId && plan.loserId && challengerAsset && opponentAsset) {
        if (plan.loserId === challengerAsset.player_id) {
          if (challengerAsset.stars <= 0) {
            shouldTransfer = false;
          }
        } else if (opponentAsset && opponentAsset.player_id === plan.loserId && opponentAsset.stars <= 0) {
          shouldTransfer = false;
        }
      }

      if (shouldTransfer && plan.winnerId && plan.loserId) {
        await client.queryObject({
          text: "update player_assets set stars = stars + 1, updated_at = $1 where player_id = $2",
          args: [nowIso(), plan.winnerId]
        });
        await client.queryObject({
          text: "update player_assets set stars = greatest(stars - 1, 0), updated_at = $1 where player_id = $2",
          args: [nowIso(), plan.loserId]
        });
        await client.queryObject({
          text: "insert into star_transfers (room_id, from_player, to_player, amount, created_at) values ($1, $2, $3, 1, $4)",
          args: [match.room_id, plan.loserId, plan.winnerId, nowIso()]
        });
      }

      await client.queryObject({
        text: "update matches set status = 'resolved', resolved_at = $1 where id = $2",
        args: [nowIso(), match_id]
      });

      await client.queryObject({
        text: "insert into used_card_logs (player_id, match_id, hand, created_at) values ($1, $2, $3, $4)",
        args: [match.challenger_id, match_id, challengerMove.hand, nowIso()]
      });
      await client.queryObject({
        text: "insert into used_card_logs (player_id, match_id, hand, created_at) values ($1, $2, $3, $4)",
        args: [match.opponent_id, match_id, opponentMove.hand, nowIso()]
      });

      await client.queryObject({
        text: "insert into events (room_id, message, created_at) values ($1, $2, $3)",
        args: [match.room_id, plan.message, nowIso()]
      });

      return {
        result: {
          outcome: plan.outcome,
          winner: plan.winnerId,
          loser: plan.loserId
        }
      };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    let status = 500;
    if (message === "Match not found") status = 404;
    else if (message === "Both players must set a card" || message === "両者がオープンする必要があります" || message === "セット情報が不足しています") {
      status = 400;
    }
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
});
