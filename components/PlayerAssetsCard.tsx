interface PlayerAssetsCardProps {
  name: string;
  stars: number;
  cash: number;
  loan: number;
  rock: number;
  paper: number;
  scissors: number;
}

export const PlayerAssetsCard = ({ name, stars, cash, loan, rock, paper, scissors }: PlayerAssetsCardProps) => {
  return (
    <div className="rounded-3xl bg-slate-900/70 p-6 shadow-lg">
      <h2 className="text-2xl font-bold">{name}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 text-lg">
        <div className="rounded-2xl bg-slate-800/60 p-4">
          <p className="text-sm uppercase tracking-widest text-slate-400">Stars</p>
          <p className="text-3xl font-black text-yellow-300">{stars}</p>
        </div>
        <div className="rounded-2xl bg-slate-800/60 p-4">
          <p className="text-sm uppercase tracking-widest text-slate-400">Cash</p>
          <p className="text-3xl font-black text-emerald-300">¥{cash.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-slate-800/60 p-4">
          <p className="text-sm uppercase tracking-widest text-slate-400">Loan</p>
          <p className="text-3xl font-black text-rose-300">¥{loan.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-slate-800/60 p-4">
          <p className="text-sm uppercase tracking-widest text-slate-400">Cards</p>
          <p className="text-lg">✊ {rock} / ✋ {paper} / ✌️ {scissors}</p>
        </div>
      </div>
    </div>
  );
};
