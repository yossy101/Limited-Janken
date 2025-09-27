import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { z } from "zod";
import { MatchControls } from "../components/MatchControls";
import { MatchQueue } from "../components/MatchQueue";
import { PlayerAssetsCard } from "../components/PlayerAssetsCard";
import { TradePanel } from "../components/TradePanel";
import { Hand } from "../shared/game/engine";
import { getBrowserClient } from "../lib/supabase";

const proposeSchema = z.object({
  challengerId: z.string().uuid(),
  opponentId: z.string().uuid()
});

const acceptSchema = z.object({
  matchId: z.string().uuid(),
  opponentId: z.string().uuid()
});

const moveSchema = z.object({
  matchId: z.string().uuid(),
  playerId: z.string().uuid(),
  hand: z.enum(["rock", "paper", "scissors"])
});

const PlayerPage = () => {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [matchId, setMatchId] = useState<string>("");
  const [phase, setPhase] = useState<"idle" | "check" | "set" | "open" | "resolved">("idle");
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => {
    try {
      return getBrowserClient();
    } catch (clientError) {
      console.warn(clientError);
      return null;
    }
  }, []);

  const fetcher = async (key: string) => {
    if (!supabase) throw new Error("Supabase client not ready");
    const [resource, id] = key.split(":");
    if (resource === "assets") {
      const { data, error: fetchError } = await supabase
        .from("player_assets")
        .select("stars, cash, loan, rock, paper, scissors, players(name)")
        .eq("player_id", id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      return data;
    }
    if (resource === "matches") {
      const { data, error: fetchError } = await supabase
        .from("matches")
        .select("id, status, challenger:challenger_id(name), opponent:opponent_id(name)")
        .or(`challenger_id.eq.${id},opponent_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (fetchError) throw fetchError;
      return data;
    }
    if (resource === "trades") {
      const { data, error: fetchError } = await supabase
        .from("trade_offers")
        .select("id, status, maker:maker_id(name), taker:taker_id(name), give_json, take_json")
        .eq("room_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (fetchError) throw fetchError;
      return data;
    }
    return null;
  };

  const { data: assets } = useSWR(playerId ? `assets:${playerId}` : null, fetcher, { refreshInterval: 5000 });
  const { data: matchList } = useSWR(playerId ? `matches:${playerId}` : null, fetcher, { refreshInterval: 5000 });
  const { data: tradeOffers } = useSWR(roomId ? `trades:${roomId}` : null, fetcher, { refreshInterval: 8000 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setRoomId(room);
  }, []);

  const handlePropose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const challengerId = (form.get("challengerId") ?? "").toString();
    const opponentId = (form.get("opponentId") ?? "").toString();
    const parsed = proposeSchema.safeParse({ challengerId, opponentId });
    if (!parsed.success) {
      setError("挑戦情報が正しくありません");
      return;
    }

    if (!supabase) {
      setError("Supabase clientが未設定です");
      return;
    }

    const { error: rpcError } = await supabase.functions.invoke("propose_match", {
      body: {
        challenger_id: parsed.data.challengerId,
        opponent_id: parsed.data.opponentId
      }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPhase("idle");
      event.currentTarget.reset();
    }
  };

  const handleAccept = async (matchIdValue: string) => {
    setError(null);
    const parsed = acceptSchema.safeParse({ matchId: matchIdValue, opponentId: playerId });
    if (!parsed.success) {
      setError("受諾できません");
      return;
    }
    if (!supabase) {
      setError("Supabase clientが未設定です");
      return;
    }
    const { error: rpcError } = await supabase.functions.invoke("accept_match", {
      body: { match_id: parsed.data.matchId, opponent_id: parsed.data.opponentId }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMatchId(matchIdValue);
      setPhase("idle");
    }
  };

  const handleCheck = async () => {
    if (!matchId || !playerId) {
      setError("マッチIDかプレイヤーIDが未設定です");
      return;
    }
    if (!supabase) return;
    const { error: rpcError } = await supabase.functions.invoke("move_check", {
      body: { match_id: matchId, player_id: playerId }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPhase("check");
    }
  };

  const handleSet = async (hand: Hand) => {
    if (!matchId || !playerId) {
      setError("マッチIDかプレイヤーIDが未設定です");
      return;
    }
    if (!supabase) return;
    const parsed = moveSchema.safeParse({ matchId, playerId, hand });
    if (!parsed.success) {
      setError("手札が不正です");
      return;
    }
    const { error: rpcError } = await supabase.functions.invoke("move_set", {
      body: {
        match_id: parsed.data.matchId,
        player_id: parsed.data.playerId,
        hand: parsed.data.hand
      }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPhase("set");
    }
  };

  const handleOpen = async () => {
    if (!matchId || !playerId) {
      setError("マッチIDかプレイヤーIDが未設定です");
      return;
    }
    if (!supabase) return;
    const { error: rpcError } = await supabase.functions.invoke("move_open", {
      body: { match_id: matchId, player_id: playerId }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPhase("open");
    }
  };

  const handleResolve = async () => {
    if (!matchId) {
      setError("マッチIDが未設定です");
      return;
    }
    if (!supabase) return;
    const { error: rpcError } = await supabase.functions.invoke("resolve_match", {
      body: { match_id: matchId }
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPhase("resolved");
    }
  };

  const handleTradeCreate = async (payload: { give: string; take: string; taker?: string }) => {
    if (!playerId) {
      setError("プレイヤーIDを入力してください");
      return;
    }
    if (!supabase) return;
    try {
      const give = JSON.parse(payload.give || "{}");
      const take = JSON.parse(payload.take || "{}");
      const { error: rpcError } = await supabase.functions.invoke("create_trade_offer", {
        body: {
          maker_id: playerId,
          taker_id: payload.taker,
          give_json: give,
          take_json: take
        }
      });
      if (rpcError) setError(rpcError.message);
    } catch (tradeError) {
      setError("JSONの形式が不正です");
    }
  };

  const handleTradeAccept = async (offerId: string) => {
    if (!playerId) {
      setError("プレイヤーIDを入力してください");
      return;
    }
    if (!supabase) return;
    const { error: rpcError } = await supabase.functions.invoke("accept_trade_offer", {
      body: {
        offer_id: offerId,
        taker_id: playerId
      }
    });
    if (rpcError) setError(rpcError.message);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-black">限定じゃんけん・プレイヤー</h1>
          <p className="text-slate-300">スマホから試合と取引を進行します。</p>
        </header>

        <section className="rounded-3xl bg-slate-900/70 p-6 shadow-lg">
          <h2 className="text-xl font-bold">自分の情報</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <label className="flex flex-col gap-2">
              <span>Room ID</span>
              <input className="rounded-xl bg-slate-800/60 p-3" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            </label>
            <label className="flex flex-col gap-2">
              <span>Player ID</span>
              <input className="rounded-xl bg-slate-800/60 p-3" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
            </label>
            <label className="flex flex-col gap-2">
              <span>現在のマッチID</span>
              <input className="rounded-xl bg-slate-800/60 p-3" value={matchId} onChange={(e) => setMatchId(e.target.value)} />
            </label>
          </div>
          {assets && (
            <div className="mt-6">
              <PlayerAssetsCard
                name={assets.players?.name ?? "あなた"}
                stars={assets.stars ?? 0}
                cash={Number(assets.cash ?? 0)}
                loan={Number(assets.loan ?? 0)}
                rock={assets.rock ?? 0}
                paper={assets.paper ?? 0}
                scissors={assets.scissors ?? 0}
              />
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-slate-900/70 p-6 shadow-lg space-y-4">
          <h2 className="text-xl font-bold">挑戦する</h2>
          <form onSubmit={handlePropose} className="grid grid-cols-1 gap-3 text-sm">
            <input name="challengerId" placeholder="自分のプレイヤーID" className="rounded-xl bg-slate-800/60 p-3" required />
            <input name="opponentId" placeholder="相手のプレイヤーID" className="rounded-xl bg-slate-800/60 p-3" required />
            <button type="submit" className="rounded-xl bg-brand px-4 py-3 text-lg font-bold transition hover:scale-105">
              挑戦する
            </button>
          </form>
          <MatchQueue
            matches={(matchList ?? []).map((match: any) => ({
              id: match.id,
              challenger: match.challenger?.name ?? "???",
              opponent: match.opponent?.name ?? "???",
              status: match.status
            }))}
            onAccept={(match) => handleAccept(match)}
          />
        </section>

        <MatchControls
          phase={phase}
          onCheck={handleCheck}
          onSet={handleSet}
          onOpen={handleOpen}
          onResolve={handleResolve}
        />

        <TradePanel
          offers={(tradeOffers ?? []).map((offer: any) => ({
            id: offer.id,
            maker: offer.maker?.name ?? "???",
            taker: offer.taker?.name ?? undefined,
            status: offer.status,
            give: JSON.stringify(offer.give_json ?? {}),
            take: JSON.stringify(offer.take_json ?? {})
          }))}
          onCreate={handleTradeCreate}
          onAccept={handleTradeAccept}
        />

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  );
};

export default PlayerPage;
