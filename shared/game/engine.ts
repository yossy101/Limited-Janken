export type Hand = "rock" | "paper" | "scissors";
export type MatchPhase = "waiting" | "set" | "open" | "resolved";
export type MatchOutcome = "challenger" | "opponent" | "draw";

export interface PlayerState {
  id: string;
  displayName: string;
  stars: number;
  cards: Record<Hand, number>;
}

const beats: Record<Hand, Hand> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper"
};

export function judgeHands(challenger: Hand, opponent: Hand): MatchOutcome {
  if (challenger === opponent) {
    return "draw";
  }
  return beats[challenger] === opponent ? "challenger" : "opponent";
}

export interface MatchResolution {
  outcome: MatchOutcome;
  challengerDelta: number;
  opponentDelta: number;
}

export function resolveStars(
  challenger: Hand,
  opponent: Hand,
  wager: number
): MatchResolution {
  const outcome = judgeHands(challenger, opponent);
  if (outcome === "draw") {
    return { outcome, challengerDelta: 0, opponentDelta: 0 };
  }
  const winnerDelta = wager;
  return outcome === "challenger"
    ? { outcome, challengerDelta: winnerDelta, opponentDelta: -winnerDelta }
    : { outcome, challengerDelta: -winnerDelta, opponentDelta: winnerDelta };
}

export function canPlayHand(player: PlayerState, hand: Hand): boolean {
  return (player.cards[hand] ?? 0) > 0;
}

export function applyHandUsage(player: PlayerState, hand: Hand): PlayerState {
  if (!canPlayHand(player, hand)) {
    throw new Error(`Player ${player.id} has no ${hand} cards left.`);
  }
  return {
    ...player,
    cards: {
      ...player.cards,
      [hand]: player.cards[hand] - 1
    }
  };
}
