import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { callEdgeFunction } from "../lib/rpc";

const proposeSchema = z.object({
  challenger_id: z.string().uuid("有効な挑戦者IDを入力してください"),
  opponent_id: z.string().uuid("有効な対戦相手IDを入力してください")
});

const acceptSchema = z.object({
  match_id: z.string().uuid("マッチIDが不正です"),
  opponent_id: z.string().uuid("プレイヤーIDが不正です")
});

export function MatchmakingPanel({ playerId }: { playerId: string }) {
  const [opponentId, setOpponentId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const propose = async () => {
    setError(null);
    try {
      await callEdgeFunction("propose-match", proposeSchema, {
        challenger_id: playerId,
        opponent_id: opponentId
      });
      setStatus(`挑戦リクエストを送信しました: ${opponentId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const accept = async () => {
    setError(null);
    try {
      await callEdgeFunction("accept-match", acceptSchema, {
        match_id: matchId,
        opponent_id: playerId
      });
      setStatus(`マッチ ${matchId} を承諾しました`);
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
      <h2 className="text-xl font-semibold text-neon">マッチング</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-300">対戦相手のID</label>
          <input
            value={opponentId}
            onChange={(event) => setOpponentId(event.target.value)}
            className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
            placeholder="uuid"
          />
          <button
            className="mt-2 w-full rounded-xl bg-cyber px-4 py-2 font-semibold hover:bg-purple-500 transition"
            onClick={propose}
          >
            挑戦する
          </button>
        </div>
        <div className="pt-4 border-t border-[#1f2d52]">
          <label className="text-sm text-gray-300">承諾するマッチID</label>
          <input
            value={matchId}
            onChange={(event) => setMatchId(event.target.value)}
            className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
            placeholder="uuid"
          />
          <button
            className="mt-2 w-full rounded-xl bg-neon text-night px-4 py-2 font-semibold hover:bg-emerald-300 transition"
            onClick={accept}
          >
            マッチを承諾
          </button>
        </div>
      </div>
      {status && <p className="text-sm text-cyan-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </motion.div>
  );
}
