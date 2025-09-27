import React from "react";

interface TradeOffer {
  id: string;
  maker: string;
  taker?: string;
  status: string;
  give: string;
  take: string;
}

interface TradePanelProps {
  offers: TradeOffer[];
  onCreate: (payload: { give: string; take: string; taker?: string }) => void;
  onAccept: (offerId: string) => void;
}

export const TradePanel = ({ offers, onCreate, onAccept }: TradePanelProps) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const give = form.get("give")?.toString() ?? "";
    const take = form.get("take")?.toString() ?? "";
    const taker = form.get("taker")?.toString() || undefined;
    onCreate({ give, take, taker });
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-4 rounded-3xl bg-slate-900/70 p-6 shadow-lg">
      <h2 className="text-2xl font-bold">トレード</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 text-sm">
        <input name="give" placeholder="渡すもの (JSON)" className="rounded-xl bg-slate-800/60 p-3" required />
        <input name="take" placeholder="受け取るもの (JSON)" className="rounded-xl bg-slate-800/60 p-3" required />
        <input name="taker" placeholder="相手プレイヤーID (任意)" className="rounded-xl bg-slate-800/60 p-3" />
        <button type="submit" className="rounded-xl bg-brand px-4 py-3 text-lg font-bold transition hover:scale-105">
          オファー作成
        </button>
      </form>
      <div className="space-y-3">
        {offers.length === 0 && <p className="text-sm text-slate-400">オファーはありません。</p>}
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-2xl bg-slate-800/50 p-4 text-sm">
            <p className="font-semibold">{offer.maker}</p>
            <p>Give: {offer.give}</p>
            <p>Take: {offer.take}</p>
            <p className="text-xs uppercase text-slate-500">{offer.status}</p>
            {offer.status === "open" && (
              <button
                className="mt-2 rounded-xl bg-emerald-500 px-3 py-2 font-bold text-emerald-950"
                onClick={() => onAccept(offer.id)}
              >
                受諾
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
