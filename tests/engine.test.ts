import { judgeRound, isValidHand } from "../shared/game/engine";

describe("judgeRound", () => {
  it("returns draw when both hands are the same", () => {
    const result = judgeRound({ playerId: "a", hand: "rock" }, { playerId: "b", hand: "rock" });
    expect(result.outcome).toBe("draw");
    expect(result.winner).toBeNull();
  });

  it("determines winner for rock vs scissors", () => {
    const result = judgeRound({ playerId: "a", hand: "rock" }, { playerId: "b", hand: "scissors" });
    expect(result.winner).toBe("a");
    expect(result.loser).toBe("b");
    expect(result.outcome).toBe("win");
  });

  it("determines winner for paper vs rock", () => {
    const result = judgeRound({ playerId: "a", hand: "paper" }, { playerId: "b", hand: "rock" });
    expect(result.winner).toBe("a");
  });

  it("determines loser for scissors vs rock", () => {
    const result = judgeRound({ playerId: "a", hand: "scissors" }, { playerId: "b", hand: "rock" });
    expect(result.loser).toBe("a");
    expect(result.outcome).toBe("lose");
  });
});

describe("isValidHand", () => {
  it("validates correct hands", () => {
    expect(isValidHand("rock")).toBe(true);
    expect(isValidHand("paper")).toBe(true);
    expect(isValidHand("scissors")).toBe(true);
  });

  it("rejects invalid hands", () => {
    expect(isValidHand("lizard")).toBe(false);
    expect(isValidHand(null)).toBe(false);
    expect(isValidHand(123)).toBe(false);
  });
});
