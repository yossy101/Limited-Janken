import { motion } from "framer-motion";

type PlayerRow = {
  id: string;
  name: string;
  stars: number;
  rock: number;
  paper: number;
  scissors: number;
};

interface ScoreboardProps {
  players: PlayerRow[];
}

export const Scoreboard = ({ players }: ScoreboardProps) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-slate-900/80 p-4 shadow-xl">
      <h2 className="mb-4 text-2xl font-bold">スコアボード</h2>
      <div className="grid grid-cols-6 gap-2 text-sm font-semibold text-slate-300">
        <span>プレイヤー</span>
        <span>⭐</span>
        <span>✊</span>
        <span>✋</span>
        <span>✌️</span>
        <span>状況</span>
      </div>
      <div className="mt-2 space-y-2">
        {players.map((player) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-6 items-center gap-2 rounded-xl bg-slate-800/60 p-3"
          >
            <span className="text-lg font-semibold">{player.name}</span>
            <span className="text-center text-xl text-yellow-300">{player.stars}</span>
            <span className="text-center text-lg">{player.rock}</span>
            <span className="text-center text-lg">{player.paper}</span>
            <span className="text-center text-lg">{player.scissors}</span>
            <span className="text-right text-xs uppercase text-slate-400">ready</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
