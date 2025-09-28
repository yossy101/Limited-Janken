import { planResolution } from "../edge-functions/_shared/logic/resolveMatch";

describe("planResolution", () => {
  it("detects draw and disables star transfer", () => {
    const plan = planResolution(
      {
        challengerId: "c",
        opponentId: "o",
        roomId: "r",
        challengerName: "挑戦者",
        opponentName: "相手"
      },
      { player_id: "c", hand: "rock" },
      { player_id: "o", hand: "rock" },
      { player_id: "c", stars: 2 },
      { player_id: "o", stars: 2 }
    );

    expect(plan.outcome).toBe("draw");
    expect(plan.shouldTransferStar).toBe(false);
    expect(plan.winnerId).toBeNull();
  });

  it("awards star transfer when winner and loser have stock", () => {
    const plan = planResolution(
      {
        challengerId: "c",
        opponentId: "o",
        roomId: "r",
        challengerName: "挑戦者",
        opponentName: "相手"
      },
      { player_id: "c", hand: "rock" },
      { player_id: "o", hand: "scissors" },
      { player_id: "c", stars: 2 },
      { player_id: "o", stars: 3 }
    );

    expect(plan.outcome).toBe("win");
    expect(plan.winnerId).toBe("c");
    expect(plan.shouldTransferStar).toBe(true);
  });
});
