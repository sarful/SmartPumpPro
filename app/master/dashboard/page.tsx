"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type AdminRow = { _id: string; username: string; status: string; loadShedding?: boolean; suspendReason?: string };
type UserRow = { _id: string; username: string; adminId: string; adminName?: string; availableMinutes: number; motorStatus: string; status?: string; suspendReason?: string };
type UserWithAdmin = { _id: string; username: string; adminId: string; adminName?: string; status?: string; suspendReason?: string };

export default function MasterDashboardPage() {
  const { data: session, status } = useSession();
  const isMaster = session?.user?.role === "master";

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [overview, setOverview] = useState<{ adminCount: number; userCount: number; running: number; waiting: number } | null>(null);
  const [allAdmins, setAllAdmins] = useState<AdminRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserWithAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", status: "pending" });
  const [newUser, setNewUser] = useState({ username: "", password: "", adminId: "" });

  const loadData = async () => {
    if (!isMaster) return;
    setLoading(true);
    setError(null);
    try {
      const [adminsRes, usersRes, overviewRes] = await Promise.all([
        fetch("/api/master/admins"),
        fetch("/api/master/users"),
        fetch("/api/master/overview"),
      ]);
      const a = await adminsRes.json();
      const u = await usersRes.json();
      const o = await overviewRes.json();
      if (!adminsRes.ok) throw new Error(a.error || "Failed to load admins");
      if (!usersRes.ok) throw new Error(u.error || "Failed to load users");
      setAdmins(a.admins || []);
      setUsers(u.users || []);
      setOverview(o);
      setAllAdmins(o.admins || []);
      setAllUsers(o.users || []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isMaster) loadData();
  }, [status, isMaster]);

  const createAdmin = async () => {
    setError(null);
    const res = await fetch("/api/master/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAdmin),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Create admin failed");
    setNewAdmin({ username: "", password: "", status: "pending" });
    loadData();
  };

  const deleteAdmin = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/master/admins/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Delete admin failed");
    loadData();
  };

  const suspendAdmin = async (id: string) => {
    setError(null);
    const reason = prompt("Suspend reason?") ?? "";
    const res = await fetch("/api/master/admins/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: id, reason }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Suspend admin failed");
    loadData();
  };

  const unsuspendAdmin = async (id: string) => {
    setError(null);
    const res = await fetch("/api/master/admins/unsuspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: id }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Unsuspend admin failed");
    loadData();
  };

  const createUser = async () => {
    setError(null);
    const res = await fetch("/api/master/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Create user failed");
    setNewUser({ username: "", password: "", adminId: "" });
    loadData();
  };

  const deleteUser = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/master/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Delete user failed");
    loadData();
  };

  const suspendUser = async (id: string) => {
    setError(null);
    const reason = prompt("Suspend reason?") ?? "";
    const res = await fetch("/api/master/users/suspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, reason }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Suspend user failed");
    loadData();
  };

  const unsuspendUser = async (id: string) => {
    setError(null);
    const res = await fetch("/api/master/users/unsuspend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Unsuspend user failed");
    loadData();
  };

  const approveAdmin = async (id: string) => {
    setError(null);
    const res = await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: id }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Approve admin failed");
    loadData();
  };

  if (status === "loading") return <div className="p-6 text-slate-200">Loading session...</div>;
  if (!isMaster) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">Master admin access required.</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Go to Login
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
            <h1 className="text-2xl font-semibold sm:text-3xl">Master Dashboard</h1>
            <p className="text-sm text-slate-300">Create/approve/delete admins, manage users system-wide.</p>
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

        {overview && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Admins" value={overview.adminCount} />
            <StatCard title="Users" value={overview.userCount} />
            <StatCard title="Running" value={overview.running} />
            <StatCard title="Waiting" value={overview.waiting} />
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
          <div className="text-sm text-slate-400">All Admins</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {allAdmins.map((ad) => (
              <div key={ad._id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-100">
                <div className="font-semibold">{ad.username}</div>
                <div className="text-slate-400 text-xs">
                  Status: {ad.status}
                  {ad.suspendReason ? ` (${ad.suspendReason})` : ""}
                </div>
                <div className="text-slate-400 text-xs">Load: {ad.loadShedding ? "ON" : "OFF"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ad.status === "suspended" ? (
                    <button
                      onClick={() => unsuspendAdmin(ad._id)}
                      className="rounded-lg border border-emerald-500 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-800/40"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendAdmin(ad._id)}
                      className="rounded-lg border border-amber-500 px-3 py-1 text-xs text-amber-200 hover:bg-amber-800/40"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => deleteAdmin(ad._id)}
                    className="rounded-lg border border-red-600 px-3 py-1 text-xs text-red-200 hover:bg-red-800/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {allAdmins.length === 0 && <div className="text-sm text-slate-300">No admins.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
          <div className="text-sm text-slate-400">All Users</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {allUsers.map((u) => (
              <div key={u._id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-100">
                <div className="font-semibold">{u.username}</div>
                <div className="text-slate-400 text-xs">Admin: {u.adminName ?? u.adminId}</div>
                <div className="text-slate-400 text-xs">
                  Status: {u.status ?? "active"}
                  {u.suspendReason ? ` (${u.suspendReason})` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {u.status === "suspended" ? (
                    <button
                      onClick={() => unsuspendUser(u._id)}
                      className="rounded-lg border border-emerald-500 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-800/40"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendUser(u._id)}
                      className="rounded-lg border border-amber-500 px-3 py-1 text-xs text-amber-200 hover:bg-amber-800/40"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(u._id)}
                    className="rounded-lg border border-red-600 px-3 py-1 text-xs text-red-200 hover:bg-red-800/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {allUsers.length === 0 && <div className="text-sm text-slate-300">No users.</div>}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
            <div className="text-sm text-slate-400">Create Admin</div>
            <input
              className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="username"
              value={newAdmin.username}
              onChange={(e) => setNewAdmin((p) => ({ ...p, username: e.target.value }))}
            />
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="password (min 6)"
              value={newAdmin.password}
              onChange={(e) => setNewAdmin((p) => ({ ...p, password: e.target.value }))}
            />
            <select
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={newAdmin.status}
              onChange={(e) => setNewAdmin((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="active">active</option>
            </select>
            <button
              onClick={createAdmin}
              className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/30 hover:bg-emerald-400"
            >
              Create Admin
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
            <div className="text-sm text-slate-400">Create User</div>
            <input
              className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="username"
              value={newUser.username}
              onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            />
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              placeholder="password (min 6)"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
            <select
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={newUser.adminId}
              onChange={(e) => setNewUser((p) => ({ ...p, adminId: e.target.value }))}
            >
              <option value="">Select admin</option>
              {admins.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.username} ({a.status})
                </option>
              ))}
            </select>
            <button
              onClick={createUser}
              className="mt-3 w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300 disabled:opacity-60"
              disabled={!newUser.adminId}
            >
              Create User
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
          <div className="text-sm text-slate-400">Admins</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Load Shedding</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {admins.map((a) => (
                  <tr key={a._id}>
                    <td className="px-2 py-2">{a.username}</td>
                    <td className="px-2 py-2">{a.status}</td>
                    <td className="px-2 py-2">{a.loadShedding ? "ON" : "OFF"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        {a.status === "pending" && (
                          <button
                            onClick={() => approveAdmin(a._id)}
                            className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => deleteAdmin(a._id)}
                          className="rounded-lg border border-red-600 px-2 py-1 text-xs text-red-200 hover:bg-red-800/50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={4}>
                      No admins found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/40">
          <div className="text-sm text-slate-400">Users</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Admin</th>
                  <th className="px-2 py-2 text-left">Available</th>
                  <th className="px-2 py-2 text-left">Motor</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-100">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="px-2 py-2">{u.username}</td>
                    <td className="px-2 py-2">{u.adminName ?? u.adminId}</td>
                    <td className="px-2 py-2">{u.availableMinutes} m</td>
                    <td className="px-2 py-2">{u.motorStatus}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => deleteUser(u._id)}
                        className="rounded-lg border border-red-600 px-2 py-1 text-xs text-red-200 hover:bg-red-800/50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={5}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-xl shadow-slate-950/40">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}
