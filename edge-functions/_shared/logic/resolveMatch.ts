import { Hand, judgeRound } from "../../../shared/game/engine.ts";

type MatchContext = {
  challengerId: string;
  opponentId: string;
  roomId: string;
  challengerName?: string | null;
  opponentName?: string | null;
};

type Move = {
  player_id: string;
  hand: Hand;
};

type Assets = {
  player_id: string;
  stars: number;
};

export type ResolutionPlan = {
  message: string;
  winnerId: string | null;
  loserId: string | null;
  outcome: "win" | "lose" | "draw";
  shouldTransferStar: boolean;
};

export const planResolution = (
  context: MatchContext,
  challengerMove: Move,
  opponentMove: Move,
  challengerAsset?: Assets | null,
  opponentAsset?: Assets | null
): ResolutionPlan => {
  const result = judgeRound(
    { playerId: challengerMove.player_id, hand: challengerMove.hand },
    { playerId: opponentMove.player_id, hand: opponentMove.hand }
  );

  if (result.outcome === "draw" || !result.winner || !result.loser) {
    return {
      outcome: "draw",
      winnerId: null,
      loserId: null,
      shouldTransferStar: false,
      message: `${context.challengerName ?? "挑戦者"}(${challengerMove.hand}) と ${context.opponentName ?? "相手"}(${opponentMove.hand}) はあいこでした。`
    };
  }

  const winnerAsset = result.winner === context.challengerId ? challengerAsset : opponentAsset;
  const loserAsset = result.loser === context.challengerId ? challengerAsset : opponentAsset;
  const winnerName = result.winner === context.challengerId ? context.challengerName : context.opponentName;

  if (!winnerAsset || !loserAsset) {
    return {
      outcome: result.outcome,
      winnerId: result.winner,
      loserId: result.loser,
      shouldTransferStar: false,
      message: `${winnerName ?? "勝者"} が勝利しました。`
    };
  }

  if (loserAsset.stars <= 0) {
    return {
      outcome: result.outcome,
      winnerId: result.winner,
      loserId: result.loser,
      shouldTransferStar: false,
      message: `${winnerName ?? "勝者"} が勝利しましたが、失う星がありません。`
    };
  }

  return {
    outcome: result.outcome,
    winnerId: result.winner,
    loserId: result.loser,
    shouldTransferStar: true,
    message: `${winnerName ?? "勝者"} が勝利し、星を奪いました！`
  };
};
