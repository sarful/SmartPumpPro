"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type UserRow = {
  _id: string;
  username: string;
  availableMinutes: number;
  motorStatus: string;
  motorRunningTime?: number;
  adminName?: string;
  status?: string;
  suspendReason?: string;
};

type QueueEntry = {
  _id: string;
  userId: string | { _id: string; username: string };
  position: number;
  status: string;
  requestedMinutes: number;
};

const getName = (idOrObj: string | { _id: string; username: string }, userMap: Record<string, string>) => {
  if (!idOrObj) return "Unknown";
  if (typeof idOrObj === "string") return userMap[idOrObj] || idOrObj;
  return idOrObj.username || idOrObj._id;
};

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loadShedding, setLoadShedding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ username: "", password: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [rechargeTarget, setRechargeTarget] = useState<string>("");
  const [rechargeMinutes, setRechargeMinutes] = useState(0);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [requests, setRequests] = useState<
    { _id: string; userId: string | { _id: string; username: string }; minutes: number; createdAt: string }[]
  >([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "admin";

  const loadData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, activityRes, statusRes, reqRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/activity"),
        fetch("/api/admin/status"),
        fetch("/api/admin/minute-requests"),
      ]);
      const usersJson = await usersRes.json();
      const activityJson = await activityRes.json();
      const statusJson = await statusRes.json();
      const reqJson = await reqRes.json();
      setUsers(usersJson.users ?? []);
      setQueue(activityJson.queue ?? []);
      if (statusRes.ok && statusJson.admin?.loadShedding !== undefined) {
        setLoadShedding(!!statusJson.admin.loadShedding);
      }
      if (reqRes.ok) setRequests(reqJson.requests ?? []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadData();
    }
  }, [status, isAdmin]);

  const handleCreateUser = async () => {
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setNewUser({ username: "", password: "" });
      await loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRecharge = async () => {
    setRechargeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rechargeTarget, minutes: rechargeMinutes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Recharge failed");
      setRechargeMinutes(0);
      await loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Recharge failed");
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleToggleLoadShedding = async (enabled: boolean) => {
    setToggleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/loadshedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Toggle failed");
      setLoadShedding(json.loadShedding);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    const res = await fetch("/api/admin/minute-requests/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Approve failed");
      return;
    }
    await loadData();
  };

  const handleDeclineRequest = async (id: string) => {
    const res = await fetch("/api/admin/minute-requests/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Decline failed");
      return;
    }
    await loadData();
  };

  const handleDeleteUser = async (userId: string) => {
    setError(null);
    const res = await fetch(`/api/admin/users?userId=${userId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }
    await loadData();
  };

  const handleSuspendUser = async (userId: string) => {
    setError(null);
    setSuspendError(null);
    const reasonPrompt = prompt("Suspend reason?");
    if (reasonPrompt === null) return;
    const reason = reasonPrompt.trim() || undefined;
    const res = await fetch("/api/admin/users/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSuspendError(json.error || "Suspend failed");
      return;
    }
    setStatusMessage("User suspended");
    await loadData();
  };

  const handleUnsuspendUser = async (userId: string) => {
    setError(null);
    setSuspendError(null);
    const res = await fetch("/api/admin/users/unsuspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSuspendError(json.error || "Unsuspend failed");
      return;
    }
    setStatusMessage("User reactivated");
    await loadData();
  };

  if (status === "loading") {
    return <div className="p-6 text-slate-200">Loading session...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">Admin access required.</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">SmartPump Pro</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Admin Dashboard</h1>
            <p className="text-sm text-slate-300">
              Manage users, wallet recharges, load shedding, and queue.
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Logout
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {suspendError && (
          <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {suspendError}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
            {statusMessage}
          </div>
        )}

        {loadShedding && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-900/30 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/30">
            Warning: load shedding active. Some actions are paused.
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-300">Loading data...</div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
            <div className="text-sm text-slate-400">Load Shedding</div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {loadShedding ? "ACTIVE" : "OFF"}
            </div>
            <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleToggleLoadShedding(true)}
                    disabled={toggleLoading}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleToggleLoadShedding(false)}
                    disabled={toggleLoading}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100 hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
                <div className="text-sm text-slate-400">Create User</div>
                <input
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  placeholder="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                />
                <input
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  placeholder="password (min 6)"
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                />
                <button
                  onClick={handleCreateUser}
                  disabled={createLoading}
                  className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/30 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {createLoading ? "Creating..." : "Create User"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
                <div className="text-sm text-slate-400">Recharge Minutes</div>
                <select
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={rechargeTarget}
                  onChange={(e) => setRechargeTarget(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.username} (bal {u.availableMinutes}m)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="minutes to add"
                  value={rechargeMinutes}
                  onChange={(e) => setRechargeMinutes(Math.max(0, Number(e.target.value)))}
                />
                <button
                  onClick={handleRecharge}
                  disabled={rechargeLoading || !rechargeTarget || rechargeMinutes <= 0}
                  className="mt-3 w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {rechargeLoading ? "Recharging..." : "Recharge"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Users</div>
                <div className="text-lg font-semibold text-slate-100">Your tenant</div>
              </div>
            </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Admin</th>
                  <th className="px-2 py-2 text-left">Available</th>
                  <th className="px-2 py-2 text-left">Motor</th>
                  <th className="px-2 py-2 text-left">Running Time</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="px-2 py-2">{u.username}</td>
                  <td className="px-2 py-2">{u.adminName ?? "You"}</td>
                  <td className="px-2 py-2">{u.availableMinutes} m</td>
                  <td className="px-2 py-2">{u.motorStatus}</td>
                  <td className="px-2 py-2">{u.motorRunningTime ?? 0} m</td>
                  <td className="px-2 py-2">
                    {u.status ?? "active"}
                    {u.suspendReason ? ` (${u.suspendReason})` : ""}
                  </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDeleteUser(u._id)}
                        className="rounded-lg border border-red-600 px-2 py-1 text-xs text-red-200 hover:bg-red-800/50"
                      >
                        Delete
                      </button>
                      {u.status === "suspended" ? (
                        <button
                          onClick={() => handleUnsuspendUser(u._id)}
                          className="ml-2 rounded-lg border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspendUser(u._id)}
                          className="ml-2 rounded-lg border border-amber-500 px-2 py-1 text-xs text-amber-200 hover:bg-amber-800/50"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={6}>
                        No users yet.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
              <div className="text-sm text-slate-400">Queue / Activity</div>
              <div className="mt-2 text-lg font-semibold text-slate-100">Running & Waiting</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {queue.map((q) => {
                  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));
                  const uname = getName(q.userId, userMap);
                  return (
                    <div
                      key={q._id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        <span>Pos #{q.position}</span>
                        <span className="text-xs uppercase text-cyan-200">{q.status}</span>
                      </div>
                      <div className="mt-2 text-slate-300">User: {uname}</div>
                      <div className="text-slate-400">Req: {q.requestedMinutes}m</div>
                    </div>
                  );
                })}
                {queue.length === 0 && (
                  <div className="text-sm text-slate-400">No active queue.</div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
              <div className="text-sm text-slate-400">Minute Requests</div>
              <div className="mt-3 text-xs text-slate-400">
                Pending requests from your users
              </div>
              <div className="mt-4 space-y-3">
                {requests.length === 0 && <p className="text-sm text-slate-300">No pending requests.</p>}
                {requests.map((r) => {
                  const userMap = Object.fromEntries(users.map((u) => [u._id, u.username]));
                  const uname = getName(r.userId, userMap);
                  return (
                    <div
                      key={r._id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100"
                    >
                      <div>
                        <div>User: {uname}</div>
                        <div className="text-slate-400">Minutes: {r.minutes}</div>
                        <div className="text-slate-500 text-xs">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(r._id)}
                          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(r._id)}
                          className="rounded-lg border border-red-600 px-3 py-2 text-xs text-red-200 hover:bg-red-800/50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
