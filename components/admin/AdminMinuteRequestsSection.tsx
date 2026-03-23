import { DashboardEmptyState } from "@/components/DashboardEmptyState";

type UserRef = string | { _id: string; username: string };

export function AdminMinuteRequestsSection({
  requests,
  users,
  onApproveRequest,
  onDeclineRequest,
  getName,
}: {
  requests: { _id: string; userId: UserRef; minutes: number; createdAt: string }[];
  users: { _id: string; username: string }[];
  onApproveRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
  getName: (idOrObj: UserRef, userMap: Record<string, string>) => string;
}) {
  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
      <div className="text-sm text-slate-400">Minute Requests</div>
      <div className="mt-3 text-xs text-slate-400">Pending requests from your users</div>
      <div className="mt-4 space-y-3">
        {requests.length === 0 ? (
          <DashboardEmptyState
            title="No pending requests"
            message="New minute requests from your users will appear here for approval or decline."
          />
        ) : null}
        {requests.map((r) => {
          const uname = getName(r.userId, userMap);
          return (
            <div
              key={r._id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100"
            >
              <div>
                <div>User: {uname}</div>
                <div className="text-slate-400">Minutes: {r.minutes}</div>
                <div className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApproveRequest(r._id)}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                >
                  Approve
                </button>
                <button
                  onClick={() => onDeclineRequest(r._id)}
                  className="rounded-lg border border-red-500 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
