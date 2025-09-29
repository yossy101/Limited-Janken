import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getSupabaseClient } from "../lib/supabase";
import type { Hand } from "../shared/game/engine";

interface PlayerRow {
  id: string;
  display_name: string;
  stars: number;
  cards_rock: number;
  cards_paper: number;
  cards_scissors: number;
}

const handLabels: Record<Hand, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors"
};

export function Scoreboard() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;

    client
      .from<PlayerRow>("view_monitor_scoreboard")
      .select("*")
      .then(({ data }) => {
        if (active && data) {
          setPlayers(data);
        }
      });

    const channel = client
      .channel("limited-janken:scoreboard")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        client
          .from<PlayerRow>("view_monitor_scoreboard")
          .select("*")
          .then(({ data }) => {
            if (data) {
              setPlayers(data);
            }
          });
      });

    channel.subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, []);

  return (
    <div className="bg-[#101a3a]/70 backdrop-blur rounded-2xl p-6 shadow-2xl border border-[#2c3a64] text-left">
      <h2 className="text-2xl font-bold mb-4 text-neon">スコアボード</h2>
      <div className="grid grid-cols-4 gap-4 text-sm uppercase tracking-wide text-gray-400">
        <span>プレイヤー</span>
        <span className="text-center">Stars</span>
        <span className="text-center">Cards</span>
        <span className="text-center">Cards</span>
      </div>
      <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-2">
        {players.map((player, index) => (
          <motion.div
            key={player.id}
            className="grid grid-cols-4 gap-4 items-center bg-[#1b2548]/70 rounded-xl px-4 py-3 border border-[#27335e]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <div>
              <p className="font-semibold text-white text-lg">{player.display_name}</p>
              <p className="text-xs text-gray-400">ID: {player.id}</p>
            </div>
            <div className="text-center text-2xl font-bold text-neon">{player.stars}</div>
            <div className="flex justify-center gap-2">
              <Badge label={handLabels.rock} value={player.cards_rock} tone="bg-red-500/80" />
              <Badge label={handLabels.paper} value={player.cards_paper} tone="bg-blue-500/80" />
            </div>
            <div className="flex justify-center">
              <Badge label={handLabels.scissors} value={player.cards_scissors} tone="bg-yellow-500/80" />
            </div>
          </motion.div>
        ))}
        {players.length === 0 && (
          <p className="text-center text-gray-400 py-8">接続されたプレイヤーが表示されるまでお待ちください…</p>
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  label: string;
  value: number;
  tone: string;
}

function Badge({ label, value, tone }: BadgeProps) {
  return (
    <span className={`inline-flex flex-col items-center justify-center px-3 py-1 rounded-lg text-xs font-semibold ${tone} text-white`}>
      <span>{label}</span>
      <span className="text-lg">{value}</span>
    </span>
  );
}
