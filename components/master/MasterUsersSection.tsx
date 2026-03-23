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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-600">All Users</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <div key={u._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
            <div className="font-semibold">{u.username}</div>
            <div className="text-slate-600 text-xs">Admin: {u.adminName ?? u.adminId}</div>
            <div className="text-slate-600 text-xs break-all">RFID: {u.rfidUid || "-"}</div>
            <div className="text-slate-600 text-xs">Balance: {u.availableMinutes ?? 0} m</div>
            <div className="text-slate-600 text-xs">Motor: {u.motorStatus ?? "OFF"}</div>
            <div className="text-slate-600 text-xs">Running Time: {u.motorRunningTime ?? 0} m</div>
            <div className="text-slate-600 text-xs">Use: {u.useSource ?? "-"}</div>
            <div className="text-slate-600 text-xs">
              Status: {u.status ?? "active"}
              {u.suspendReason ? ` (${u.suspendReason})` : ""}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 sm:w-28"
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
                className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100 sm:w-auto"
              >
                Recharge
              </button>
              <button
                onClick={() => {
                  const value = Number(minuteDrafts[u._id] ?? u.availableMinutes ?? 0);
                  if (!Number.isFinite(value) || value < 0) return onSetError("Set minutes must be >= 0");
                  onSetUserAvailableMinutes(u._id, Math.floor(value));
                }}
                className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100 sm:w-auto"
              >
                Set Balance
              </button>
              <button
                onClick={() => onStartUserMotor(u._id, u.motorRunningTime && u.motorRunningTime > 0 ? u.motorRunningTime : 5)}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 sm:w-auto"
              >
                Start Motor
              </button>
              <button
                onClick={() => onStopResetUserMotor(u._id)}
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-800 hover:bg-slate-200 sm:w-auto"
              >
                Stop/Reset
              </button>
              {u.status === "suspended" ? (
                <button
                  onClick={() => onUnsuspendUser(u._id)}
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100 sm:w-auto"
                >
                  Unsuspend
                </button>
              ) : (
                <button
                  onClick={() => onSuspendUser(u._id)}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100 sm:w-auto"
                >
                  Suspend
                </button>
              )}
              <button
                onClick={() => onDeleteUser(u._id)}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100 sm:w-auto"
              >
                Delete
              </button>
            </div>
          </div>
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
