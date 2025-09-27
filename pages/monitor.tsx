import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { EventLog } from "../components/EventLog";
import { RoomQRCode } from "../components/RoomQRCode";
import { Scoreboard } from "../components/Scoreboard";
import { getBrowserClient } from "../lib/supabase";

const startSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  loanAmount: z.number().min(0),
  timeLimit: z.number().min(60)
});

type PlayerScore = {
  id: string;
  name: string;
  stars: number;
  rock: number;
  paper: number;
  scissors: number;
};

type EventRow = {
  id: string | number;
  message: string;
  created_at: string;
};

const MonitorPage = () => {
  const [roomId, setRoomId] = useState("");
  const [loanAmount, setLoanAmount] = useState(3000);
  const [timeLimit, setTimeLimit] = useState(900);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [players, setPlayers] = useState<PlayerScore[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const supabase = useMemo(() => {
    try {
      return getBrowserClient();
    } catch (clientError) {
      console.warn(clientError);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase || !roomId) return;

    const fetchPlayers = async () => {
      const { data, error: fetchError } = await supabase
        .from("player_assets")
        .select("player_id, stars, rock, paper, scissors, players!inner(name, room_id)")
        .eq("players.room_id", roomId)
        .limit(30);

      if (fetchError) {
        console.warn(fetchError);
        return;
      }

      const mapped: PlayerScore[] = data?.map((row: any) => ({
        id: row.player_id,
        name: row.players?.name ?? "Anonymous",
        stars: row.stars,
        rock: row.rock,
        paper: row.paper,
        scissors: row.scissors
      })) ?? [];
      setPlayers(mapped);
    };

    void fetchPlayers();

    const channel = supabase
      .channel(`events-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setEvents((current) => [
            {
              id: payload.new.id as string | number,
              message: payload.new.message as string,
              created_at: payload.new.created_at as string
            },
            ...current
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      setTick((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  const remainingSeconds = endAt ? Math.max(0, Math.floor((endAt.getTime() - Date.now()) / 1000)) : null;
  const formattedRemaining = remainingSeconds != null
    ? `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`
    : "--:--";

  const handleStartGame = async () => {
    setError(null);
    const parsed = startSchema.safeParse({ roomId, loanAmount, timeLimit });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid form");
      return;
    }

    if (!supabase) {
      setError("Supabase clientが未設定です。環境変数を確認してください。");
      return;
    }

    const { data, error: rpcError } = await supabase.functions.invoke("start_game", {
      body: {
        room_id: parsed.data.roomId,
        time_limit_seconds: parsed.data.timeLimit,
        loan_amount: parsed.data.loanAmount
      }
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    if (data?.end_at) {
      setEndAt(new Date(data.end_at));
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const playerUrl = roomId && origin ? `${origin}/player?room=${roomId}` : "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-black">限定じゃんけん・モニター</h1>
            <p className="text-slate-300">部屋を開始し、スコアと実況を管理します。</p>
          </div>
          {roomId && playerUrl && <RoomQRCode url={playerUrl} />}
        </header>

        <section className="rounded-3xl bg-slate-900/70 p-6 shadow-xl">
          <h2 className="text-2xl font-bold">ゲーム開始</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm">
              <span>Room ID</span>
              <input
                className="rounded-xl bg-slate-800/60 p-3"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>貸付額 (¥)</span>
              <input
                type="number"
                className="rounded-xl bg-slate-800/60 p-3"
                value={loanAmount}
                onChange={(event) => setLoanAmount(Number(event.target.value))}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>制限時間 (秒)</span>
              <input
                type="number"
                className="rounded-xl bg-slate-800/60 p-3"
                value={timeLimit}
                onChange={(event) => setTimeLimit(Number(event.target.value))}
              />
            </label>
            <div className="flex items-end">
              <button
                className="w-full rounded-xl bg-brand px-4 py-3 text-lg font-bold transition hover:scale-105"
                onClick={handleStartGame}
              >
                ゲーム開始
              </button>
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Scoreboard players={players} />
            <div className="rounded-2xl bg-slate-900/80 p-4">
              <p className="text-sm uppercase tracking-widest text-slate-400">残り時間</p>
              <p className="text-5xl font-black text-emerald-300">{formattedRemaining}</p>
            </div>
          </div>
          <EventLog events={events} />
        </section>
      </div>
    </main>
  );
};

export default MonitorPage;
