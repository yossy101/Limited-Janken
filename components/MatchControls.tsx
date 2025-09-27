import { motion } from "framer-motion";
import { Hand } from "../shared/game/engine";

interface MatchControlsProps {
  phase: "idle" | "check" | "set" | "open" | "resolved";
  onCheck: () => void;
  onSet: (hand: Hand) => void;
  onOpen: () => void;
  onResolve: () => void;
  disabled?: boolean;
}

const hands: { key: Hand; label: string; emoji: string }[] = [
  { key: "rock", label: "グー", emoji: "✊" },
  { key: "paper", label: "パー", emoji: "✋" },
  { key: "scissors", label: "チョキ", emoji: "✌️" }
];

export const MatchControls = ({ phase, onCheck, onSet, onOpen, onResolve, disabled }: MatchControlsProps) => {
  return (
    <motion.div className="flex w-full flex-col gap-4 rounded-3xl bg-slate-900/70 p-6 shadow-lg">
      <h2 className="text-2xl font-bold">対戦フロー</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          className={`rounded-xl bg-brand px-4 py-3 text-lg font-bold shadow-brand/40 transition hover:scale-105 ${phase !== "idle" ? "opacity-50" : ""}`}
          onClick={onCheck}
          disabled={disabled || phase !== "idle"}
        >
          チェック
        </button>
        <div className="col-span-2 flex items-center justify-around rounded-xl bg-slate-800/50 p-3">
          {hands.map((hand) => (
            <button
              key={hand.key}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-3 text-lg font-semibold transition hover:scale-105 ${phase === "check" ? "bg-slate-700/60" : "bg-slate-800/40"}`}
              onClick={() => onSet(hand.key)}
              disabled={disabled || phase !== "check"}
            >
              <span className="text-3xl">{hand.emoji}</span>
              <span>{hand.label}</span>
            </button>
          ))}
        </div>
        <button
          className={`rounded-xl bg-emerald-500 px-4 py-3 text-lg font-bold text-emerald-950 transition hover:scale-105 ${phase !== "set" ? "opacity-50" : ""}`}
          onClick={onOpen}
          disabled={disabled || phase !== "set"}
        >
          オープン
        </button>
      </div>
      <button
        className={`rounded-xl bg-indigo-500 px-4 py-3 text-lg font-bold text-indigo-950 transition hover:scale-105 ${phase !== "open" ? "opacity-50" : ""}`}
        onClick={onResolve}
        disabled={disabled || phase !== "open"}
      >
        勝敗判定
      </button>
    </motion.div>
  );
};
