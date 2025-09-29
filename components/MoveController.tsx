import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { callEdgeFunction } from "../lib/rpc";
import type { Hand } from "../shared/game/engine";

const hands: Hand[] = ["rock", "paper", "scissors"];

const baseSchema = z.object({
  match_id: z.string().uuid("マッチIDが不正です"),
  player_id: z.string().uuid("プレイヤーIDが不正です")
});

const setSchema = baseSchema.extend({
  hand: z.enum(["rock", "paper", "scissors"])
});

export function MoveController({ matchId, playerId }: { matchId: string; playerId: string }) {
  const [selectedHand, setSelectedHand] = useState<Hand>("rock");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = async (endpoint: string, payload: Record<string, unknown>) => {
    setError(null);
    try {
      await callEdgeFunction(endpoint, baseSchema, payload as any);
      setStatus(`${endpoint} 完了`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const executeSet = async () => {
    setError(null);
    try {
      await callEdgeFunction("move-set", setSchema, {
        match_id: matchId,
        player_id: playerId,
        hand: selectedHand
      });
      setStatus(`${selectedHand} をセットしました`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <motion.div
      className="bg-[#151f3f]/80 border border-[#263463] rounded-2xl p-5 space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-xl font-semibold text-neon">手札アクション</h2>
      <div className="grid grid-cols-3 gap-2">
        {hands.map((hand) => (
          <button
            key={hand}
            onClick={() => setSelectedHand(hand)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold uppercase transition ${
              hand === selectedHand ? "bg-neon text-night" : "bg-[#0f172d] border border-[#22315c] text-gray-300"
            }`}
          >
            {hand}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionButton label="Check" onClick={() => execute("move-check", { match_id: matchId, player_id: playerId })} />
        <ActionButton label="Open" onClick={() => execute("move-open", { match_id: matchId, player_id: playerId })} />
        <ActionButton label="Resolve" onClick={() => execute("resolve-match", { match_id: matchId, player_id: playerId })} />
        <ActionButton label="Set" highlight onClick={executeSet} />
      </div>
      {status && <p className="text-sm text-cyan-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </motion.div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  highlight?: boolean;
}

function ActionButton({ label, onClick, highlight }: ActionButtonProps) {
  return (
    <button
      className={`rounded-xl px-4 py-2 font-semibold transition ${
        highlight
          ? "bg-cyber text-white hover:bg-purple-500"
          : "bg-[#0f172d] border border-[#22315c] text-gray-200 hover:border-neon"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
