interface EventLogProps {
  events: { id: string | number; message: string; created_at: string }[];
}

export const EventLog = ({ events }: EventLogProps) => {
  return (
    <div className="h-64 w-full overflow-y-auto rounded-2xl bg-slate-900/60 p-4 shadow-inner">
      <h2 className="mb-2 text-xl font-bold">実況ログ</h2>
      <ul className="space-y-2 text-sm text-slate-300">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg bg-slate-800/40 p-2">
            <span className="mr-2 text-xs text-slate-500">{new Date(event.created_at).toLocaleTimeString()}</span>
            <span>{event.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
