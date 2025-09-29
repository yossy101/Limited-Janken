import { judgeHands, resolveStars, applyHandUsage, canPlayHand } from "../shared/game/engine";

describe("judgeHands", () => {
  it("determines winner correctly", () => {
    expect(judgeHands("rock", "scissors")).toBe("challenger");
    expect(judgeHands("scissors", "rock")).toBe("opponent");
    expect(judgeHands("paper", "paper")).toBe("draw");
  });
});

describe("resolveStars", () => {
  it("awards stars to winner", () => {
    expect(resolveStars("rock", "scissors", 2)).toEqual({
      outcome: "challenger",
      challengerDelta: 2,
      opponentDelta: -2
    });
  });

  it("returns zero deltas for draw", () => {
    expect(resolveStars("rock", "rock", 3)).toEqual({
      outcome: "draw",
      challengerDelta: 0,
      opponentDelta: 0
    });
  });
});

describe("card helpers", () => {
  it("prevents using unavailable cards", () => {
    const player = { id: "p1", displayName: "A", stars: 0, cards: { rock: 0, paper: 1, scissors: 1 } };
    expect(canPlayHand(player, "rock")).toBe(false);
    expect(() => applyHandUsage(player, "rock")).toThrow(/no rock cards/);
  });

  it("consumes a card when available", () => {
    const player = { id: "p1", displayName: "A", stars: 0, cards: { rock: 2, paper: 1, scissors: 1 } };
    const updated = applyHandUsage(player, "rock");
    expect(updated.cards.rock).toBe(1);
    expect(player.cards.rock).toBe(2);
  });
});
