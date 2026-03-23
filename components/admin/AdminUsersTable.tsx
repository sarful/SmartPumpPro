import { DashboardEmptyState } from "@/components/DashboardEmptyState";

type UserRow = {
  _id: string;
  username: string;
  rfidUid?: string;
  availableMinutes: number;
  motorStatus: string;
  motorRunningTime?: number;
  adminName?: string;
  status?: string;
  suspendReason?: string;
};

export function AdminUsersTable({
  users,
  effectiveRuntimeHold,
  cardModeActive,
  cardActiveUserId,
  startLoadingUserId,
  stopResetLoadingUserId,
  adminStatus,
  loadShedding,
  deviceReady,
  internetOnline,
  onStartMotor,
  onStopResetMotor,
  onDeleteUser,
  onSuspendUser,
  onUnsuspendUser,
}: {
  users: UserRow[];
  effectiveRuntimeHold: boolean;
  cardModeActive: boolean;
  cardActiveUserId: string | null;
  startLoadingUserId: string | null;
  stopResetLoadingUserId: string | null;
  adminStatus: string;
  loadShedding: boolean | null;
  deviceReady: boolean | null;
  internetOnline: boolean;
  onStartMotor: (userId: string, requestedMinutes: number) => void;
  onStopResetMotor: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onSuspendUser: (userId: string) => void;
  onUnsuspendUser: (userId: string) => void;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-400">Users</div>
          <div className="text-lg font-semibold text-slate-100">Your tenant</div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left">Username</th>
              <th className="px-2 py-2 text-left">RFID</th>
              <th className="px-2 py-2 text-left">Admin</th>
              <th className="px-2 py-2 text-left">Available</th>
              <th className="px-2 py-2 text-left">Motor</th>
              <th className="px-2 py-2 text-left">Running Time</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="whitespace-nowrap px-2 py-2 text-center">Use</th>
              <th className="whitespace-nowrap px-2 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-100">
            {users.map((u) => (
              <tr key={u._id}>
                <td className="px-2 py-2">{u.username}</td>
                <td className="px-2 py-2 text-xs text-slate-300">{u.rfidUid || "-"}</td>
                <td className="px-2 py-2">{u.adminName ?? "You"}</td>
                <td className="px-2 py-2">{u.availableMinutes} m</td>
                <td className="px-2 py-2">
                  {u.motorStatus === "RUNNING" && effectiveRuntimeHold ? "HOLD" : u.motorStatus}
                </td>
                <td className="px-2 py-2">{u.motorRunningTime ?? 0} m</td>
                <td className="px-2 py-2">
                  {u.status ?? "active"}
                  {u.suspendReason ? ` (${u.suspendReason})` : ""}
                </td>
                <td className="px-2 py-2 text-center text-xs text-slate-300">
                  {cardModeActive && cardActiveUserId === u._id
                    ? "Card"
                    : u.motorStatus === "RUNNING"
                      ? "Web"
                      : "-"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex min-w-0 flex-col gap-2 sm:min-w-[220px] sm:flex-row sm:flex-wrap">
                    <button
                      onClick={() => onStartMotor(u._id, u.motorRunningTime && u.motorRunningTime > 0 ? u.motorRunningTime : 5)}
                      disabled={
                        startLoadingUserId === u._id ||
                        adminStatus !== "active" ||
                        Boolean(loadShedding) ||
                        deviceReady === false ||
                        !internetOnline ||
                        u.status === "suspended"
                      }
                      className="w-full rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50 disabled:opacity-60 sm:w-auto"
                    >
                      {startLoadingUserId === u._id ? "Starting..." : "Start Motor"}
                    </button>
                    <button
                      onClick={() => onStopResetMotor(u._id)}
                      disabled={stopResetLoadingUserId === u._id}
                      className="w-full rounded-lg border border-cyan-500 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50 disabled:opacity-60 sm:w-auto"
                    >
                      {stopResetLoadingUserId === u._id ? "Processing..." : "Stop/Reset"}
                    </button>
                    <button
                      onClick={() => onDeleteUser(u._id)}
                      className="w-full rounded-lg border border-red-500 px-2 py-1 text-xs text-red-700 hover:bg-red-50 sm:w-auto"
                    >
                      Delete
                    </button>
                    {u.status === "suspended" ? (
                      <button
                        onClick={() => onUnsuspendUser(u._id)}
                        className="w-full rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 sm:w-auto"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        onClick={() => onSuspendUser(u._id)}
                        className="w-full rounded-lg border border-amber-500 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 sm:w-auto"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="px-2 py-3" colSpan={8}>
                  <DashboardEmptyState
                    title="No users yet"
                    message="Create your first tenant user to unlock recharge, RFID assignment, and motor actions."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
