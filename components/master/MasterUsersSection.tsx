import { DashboardEmptyState } from "@/components/DashboardEmptyState";

type UserWithAdmin = {
  _id: string;
  username: string;
  adminId: string;
  adminName?: string;
  rfidUid?: string;
  availableMinutes?: number;
  motorStatus?: string;
  motorRunningTime?: number;
  status?: string;
  suspendReason?: string;
  useSource?: string;
};

export function MasterUsersSection({
  users,
  minuteDrafts,
  onMinuteDraftChange,
  onRechargeUserMinutes,
  onSetUserAvailableMinutes,
  onStartUserMotor,
  onStopResetUserMotor,
  onSuspendUser,
  onUnsuspendUser,
  onDeleteUser,
  onSetError,
}: {
  users: UserWithAdmin[];
  minuteDrafts: Record<string, string>;
  onMinuteDraftChange: (userId: string, value: string) => void;
  onRechargeUserMinutes: (id: string, minutes: number) => void;
  onSetUserAvailableMinutes: (id: string, minutes: number) => void;
  onStartUserMotor: (id: string, requestedMinutes?: number) => void;
  onStopResetUserMotor: (id: string) => void;
  onSuspendUser: (id: string) => void;
  onUnsuspendUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onSetError: (message: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">User Operations</div>
        <div className="text-lg font-semibold text-slate-950">All Users</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {users.map((u) => (
          <article key={u._id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-950">{u.username}</div>
                <div className="mt-1 text-xs text-slate-500">Admin: {u.adminName ?? u.adminId}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    (u.motorStatus ?? "OFF") === "RUNNING"
                      ? "bg-emerald-100 text-emerald-700"
                      : (u.motorStatus ?? "OFF") === "HOLD"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {u.motorStatus ?? "OFF"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    u.status === "suspended" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {u.status ?? "active"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">RFID</div>
                <div className="mt-1 break-all text-xs text-slate-700">{u.rfidUid || "-"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Use Source</div>
                <div className="mt-1 text-xs text-slate-700">{u.useSource ?? "-"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Balance</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{u.availableMinutes ?? 0} m</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Running Time</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{u.motorRunningTime ?? 0} m</div>
              </div>
            </div>

            {u.suspendReason ? <div className="mt-3 text-xs text-red-600">Reason: {u.suspendReason}</div> : null}

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="minutes"
                  value={minuteDrafts[u._id] ?? String(u.availableMinutes ?? 0)}
                  onChange={(e) => onMinuteDraftChange(u._id, e.target.value)}
                />
                <button
                  onClick={() => {
                    const value = Number(minuteDrafts[u._id] ?? u.availableMinutes ?? 0);
                    if (!Number.isFinite(value) || value <= 0) return onSetError("Recharge minutes must be > 0");
                    onRechargeUserMinutes(u._id, value);
                  }}
                  className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Recharge
                </button>
                <button
                  onClick={() => {
                    const value = Number(minuteDrafts[u._id] ?? u.availableMinutes ?? 0);
                    if (!Number.isFinite(value) || value < 0) return onSetError("Set minutes must be >= 0");
                    onSetUserAvailableMinutes(u._id, Math.floor(value));
                  }}
                  className="rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Set Balance
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onStartUserMotor(u._id, u.motorRunningTime && u.motorRunningTime > 0 ? u.motorRunningTime : 5)}
                  className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Start Motor
                </button>
                <button
                  onClick={() => onStopResetUserMotor(u._id)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Stop / Reset
                </button>
                {u.status === "suspended" ? (
                  <button
                    onClick={() => onUnsuspendUser(u._id)}
                    className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Unsuspend
                  </button>
                ) : (
                  <button
                    onClick={() => onSuspendUser(u._id)}
                    className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Suspend
                  </button>
                )}
                <button
                  onClick={() => onDeleteUser(u._id)}
                  className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}

        {users.length === 0 ? (
          <DashboardEmptyState
            title="No users"
            message="Create a user under an active admin before managing balance, motor state, or RFID."
          />
        ) : null}
      </div>
    </section>
  );
}
