import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSupabaseClient } from "../lib/supabase";

interface EventRow {
  id: string;
  created_at: string;
  room_id: string;
  actor_id: string | null;
  message: string;
}

export function EventFeed({ roomId }: { roomId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    const client = getSupabaseClient();
    let mounted = true;

    client
      .from<EventRow>("events")
      .select("*")
      .eq("room_id", roomId)
      .then(({ data }) => {
        if (mounted && data) {
          setEvents(data.sort((a, b) => a.created_at.localeCompare(b.created_at)));
        }
      });

    const channel = client
      .channel(`limited-janken:events:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          setEvents((prev) => [...prev.slice(-49), payload.new as EventRow]);
        }
      );

    channel.subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [roomId]);

  return (
    <div className="bg-[#0f172d]/80 border border-[#1f2d52] rounded-2xl p-4 h-full">
      <h3 className="text-lg font-semibold text-cyber mb-2">実況ログ</h3>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-[#17254a]/70 border border-[#233463] rounded-xl px-3 py-2"
            >
              <p className="text-xs text-gray-400">{new Date(event.created_at).toLocaleTimeString()}</p>
              <p className="text-sm text-white">{event.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {events.length === 0 && <p className="text-sm text-gray-500">まだイベントはありません。</p>}
      </div>
    </div>
  );
}
