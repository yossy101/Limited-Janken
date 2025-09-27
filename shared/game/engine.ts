export type Hand = "rock" | "paper" | "scissors";

export interface MatchMove {
  playerId: string;
  hand: Hand;
}

export interface MatchResult {
  winner: string | null;
  loser: string | null;
  outcome: "win" | "lose" | "draw";
}

const beats: Record<Hand, Hand> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper"
};

export function judgeRound(a: MatchMove, b: MatchMove): MatchResult {
  if (a.hand === b.hand) {
    return { winner: null, loser: null, outcome: "draw" };
  }

  if (beats[a.hand] === b.hand) {
    return { winner: a.playerId, loser: b.playerId, outcome: "win" };
  }

  if (beats[b.hand] === a.hand) {
    return { winner: b.playerId, loser: a.playerId, outcome: "lose" };
  }

  throw new Error("Invalid hand combination");
}

export function isValidHand(value: unknown): value is Hand {
  return value === "rock" || value === "paper" || value === "scissors";
}
