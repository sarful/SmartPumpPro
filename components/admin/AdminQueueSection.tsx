import { DashboardEmptyState } from "@/components/DashboardEmptyState";

type QueueEntry = {
  _id: string;
  userId: string | { _id: string; username: string };
  position: number;
  status: string;
  requestedMinutes: number;
};

export function AdminQueueSection({
  queue,
  users,
  effectiveRuntimeHold,
  getName,
}: {
  queue: QueueEntry[];
  users: { _id: string; username: string }[];
  effectiveRuntimeHold: boolean;
  getName: (idOrObj: string | { _id: string; username: string }, userMap: Record<string, string>) => string;
}) {
  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
      <div className="text-sm text-slate-400">Queue / Activity</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">Running & Waiting</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {queue.map((q) => {
          const uname = getName(q.userId, userMap);
          return (
            <div
              key={q._id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100"
            >
              <div className="flex items-center justify-between">
                <span>Pos #{q.position}</span>
                <span className="text-xs uppercase text-cyan-200">
                  {q.status === "RUNNING" && effectiveRuntimeHold ? "HOLD" : q.status}
                </span>
              </div>
              <div className="mt-2 text-slate-300">User: {uname}</div>
              <div className="text-slate-400">Req: {q.requestedMinutes}m</div>
            </div>
          );
        })}
        {queue.length === 0 ? (
          <DashboardEmptyState
            title="No active queue"
            message="Running and waiting motor sessions will appear here when users start requesting time."
          />
        ) : null}
      </div>
    </section>
  );
}
