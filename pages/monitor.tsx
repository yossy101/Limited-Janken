import Head from "next/head";
import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { Scoreboard } from "../components/Scoreboard";
import { EventFeed } from "../components/EventFeed";
import { QRDisplay } from "../components/QRDisplay";
import { callEdgeFunction } from "../lib/rpc";

const startSchema = z.object({
  room_id: z.string().uuid("ルームIDが不正です"),
  time_limit_seconds: z.number().min(30).max(3600),
  loan_amount: z.number().min(0).max(1000000)
});

export default function MonitorPage() {
  const [roomId, setRoomId] = useState<string>("00000000-0000-0000-0000-000000000000");
  const [timeLimit, setTimeLimit] = useState(600);
  const [loanAmount, setLoanAmount] = useState(3000);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startGame = async () => {
    setError(null);
    try {
      await callEdgeFunction("start-game", startSchema, {
        room_id: roomId,
        time_limit_seconds: timeLimit,
        loan_amount: loanAmount
      });
      setMessage("ゲームを開始しました");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <Head>
        <title>Limited Janken Monitor</title>
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-night via-[#111a35] to-black p-6 text-white">
        <motion.header
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-neon drop-shadow">実況電光掲示板</h1>
            <p className="text-gray-300">時間管理・資産状況・イベントログを一括監視</p>
          </div>
        </motion.header>

        <section className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            <motion.div
              className="bg-[#101a3a]/70 border border-[#25315c] rounded-2xl p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold text-cyber">ゲーム開始コントロール</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs uppercase text-gray-400">Room ID (UUID)</label>
                  <input
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                    className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-400">Time Limit (seconds)</label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(event) => setTimeLimit(Number(event.target.value))}
                    className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-400">Loan Amount</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(event) => setLoanAmount(Number(event.target.value))}
                    className="mt-1 w-full rounded-xl bg-[#0f172d] border border-[#22315c] px-3 py-2 text-white focus:outline-none focus:border-neon"
                  />
                </div>
              </div>
              <button
                className="mt-4 w-full md:w-auto px-6 py-3 rounded-xl bg-neon text-night font-semibold hover:bg-emerald-300 transition"
                onClick={startGame}
              >
                ゲーム開始
              </button>
              {message && <p className="mt-3 text-sm text-cyan-300">{message}</p>}
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </motion.div>

            <Scoreboard />
          </div>
          <div className="space-y-6">
            <QRDisplay roomCode={roomId.slice(0, 8)} />
            <EventFeed roomId={roomId} />
          </div>
        </section>
      </main>
    </>
  );
}
