import Head from "next/head";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { MatchmakingPanel } from "../components/MatchmakingPanel";
import { MoveController } from "../components/MoveController";
import { AssetsPanel } from "../components/AssetsPanel";
import { TradePanel } from "../components/TradePanel";
import { callEdgeFunction } from "../lib/rpc";

const moveCheckSchema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid()
});

export default function PlayerPage() {
  const [playerId, setPlayerId] = useState("00000000-0000-0000-0000-000000000000");
  const [matchId, setMatchId] = useState("00000000-0000-0000-0000-000000000000");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshState = async () => {
    setError(null);
    try {
      await callEdgeFunction("move-check", moveCheckSchema, {
        match_id: matchId,
        player_id: playerId
      });
      setStatus("マッチ状況を確認しました");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <Head>
        <title>Limited Janken Player</title>
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-night via-[#111a35] to-black p-4 pb-20 text-white">
        <motion.header
          className="flex flex-col items-center text-center gap-2 mb-6"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-extrabold text-neon">プレイヤーコックピット</h1>
          <p className="text-gray-300 text-sm max-w-md">
            対戦申し込みから手札オープンまでスマホで完結。進行状況はリアルタイムで実況に反映されます。
          </p>
        </motion.header>

        <section className="space-y-5">
          <motion.div
            className="bg-[#101a3a]/80 border border-[#25315c] rounded-2xl p-5 grid gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <label className="text-xs uppercase text-gray-400">あなたのプレイヤーID</label>
              <input
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
                className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-gray-400">現在のマッチID</label>
              <input
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
              />
            </div>
            <button
              className="w-full rounded-xl bg-neon text-night font-semibold px-4 py-2 hover:bg-emerald-300 transition"
              onClick={refreshState}
            >
              状況を更新
            </button>
            {status && <p className="text-sm text-cyan-300">{status}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </motion.div>

          <AssetsPanel playerId={playerId} />
          <MatchmakingPanel playerId={playerId} />
          <MoveController matchId={matchId} playerId={playerId} />
          <TradePanel />
        </section>
      </main>
    </>
  );
}
