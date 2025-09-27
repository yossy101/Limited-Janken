interface MatchQueueProps {
  matches: { id: string; challenger: string; opponent: string; status: string }[];
  onAccept?: (matchId: string) => void;
}

export const MatchQueue = ({ matches, onAccept }: MatchQueueProps) => {
  return (
    <div className="space-y-3 rounded-3xl bg-slate-900/70 p-6 shadow-lg">
      <h2 className="text-2xl font-bold">挑戦状</h2>
      {matches.length === 0 && <p className="text-sm text-slate-400">現在挑戦はありません。</p>}
      {matches.map((match) => (
        <div key={match.id} className="flex flex-col gap-2 rounded-2xl bg-slate-800/50 p-4">
          <p className="text-lg font-semibold">
            {match.challenger} → {match.opponent}
          </p>
          <p className="text-xs uppercase tracking-widest text-slate-500">{match.status}</p>
          {onAccept && (
            <button
              className="self-end rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-emerald-950 transition hover:scale-105"
              onClick={() => onAccept(match.id)}
            >
              受ける
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
