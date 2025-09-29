import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import type { Hand } from "../shared/game/engine";

interface AssetRow {
  player_id: string;
  stars: number;
  cards_rock: number;
  cards_paper: number;
  cards_scissors: number;
  cash: number;
}

const handLabels: Record<Hand, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors"
};

export function AssetsPanel({ playerId }: { playerId: string }) {
  const [assets, setAssets] = useState<AssetRow | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;

    client
      .from<AssetRow>("player_assets")
      .select("*")
      .eq("player_id", playerId)
      .single()
      .then(({ data }) => {
        if (active && data) {
          setAssets(data);
        }
      });

    const channel = client
      .channel(`limited-janken:assets:${playerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "player_assets", filter: `player_id=eq.${playerId}` },
        (payload: any) => {
          setAssets(payload.new as AssetRow);
        }
      );

    channel.subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [playerId]);

  if (!assets) {
    return (
      <div className="bg-[#151f3f]/80 border border-[#263463] rounded-2xl p-5">
        <p className="text-sm text-gray-400">資産情報を取得中…</p>
      </div>
    );
  }

  return (
    <div className="bg-[#151f3f]/80 border border-[#263463] rounded-2xl p-5 space-y-4">
      <h2 className="text-xl font-semibold text-neon">所持資産</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[#0f172d] rounded-xl p-3 border border-[#1f2d52]">
          <p className="text-gray-400">Stars</p>
          <p className="text-2xl font-bold text-neon">{assets.stars}</p>
        </div>
        <div className="bg-[#0f172d] rounded-xl p-3 border border-[#1f2d52]">
          <p className="text-gray-400">Cash</p>
          <p className="text-2xl font-bold text-cyber">¥{assets.cash.toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        {(Object.keys(handLabels) as Hand[]).map((hand) => (
          <div key={hand} className="bg-[#0f172d] rounded-xl p-3 border border-[#1f2d52]">
            <p className="text-gray-400">{handLabels[hand]}</p>
            <p className="text-xl font-semibold text-white">
              {assets[`cards_${hand}` as const]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
