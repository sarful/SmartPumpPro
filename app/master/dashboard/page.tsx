"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

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
  const [copiedAdminId, setCopiedAdminId] = useState<string | null>(null);
  const [manualAdminApproval, setManualAdminApproval] = useState(true);
  const [savingApprovalMode, setSavingApprovalMode] = useState(false);

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
      const settingsRes = await fetch("/api/master/settings");
      const settingsJson = await settingsRes.json();
      if (settingsRes.ok) {
        setManualAdminApproval(Boolean(settingsJson.manualAdminApproval));
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalMode = async (value: boolean) => {
    setSavingApprovalMode(true);
    setError(null);
    try {
      const res = await fetch("/api/master/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualAdminApproval: value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to update approval mode");
        return;
      }
      setManualAdminApproval(Boolean(json.manualAdminApproval));
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to update approval mode");
    } finally {
      setSavingApprovalMode(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isMaster) loadData();
  }, [status, isMaster]);

  const copyAdminId = async (adminId: string) => {
    try {
      await navigator.clipboard.writeText(adminId);
      setCopiedAdminId(adminId);
      setTimeout(() => setCopiedAdminId(null), 1500);
    } catch {
      setError("Failed to copy admin ID");
    }
  };

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

  if (status === "loading") return <div className="p-6 text-slate-600">Loading session...</div>;
  if (!isMaster) {
    return (
      <div className="min-h-screen bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">Master admin access required.</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-blue-600">PumpPilot</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Master Dashboard</h1>
            <p className="text-sm text-slate-600">
              Master Admin: {session?.user?.username || session?.user?.name || "-"}
            </p>
            <p className="text-sm text-slate-600">Create, approve, suspend and delete admins and users.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/logs"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Logs
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-slate-600">Admin Approval Control</div>
              <div className="text-xs text-slate-500">
                ON = new admins stay pending and need master approval. OFF = auto approve new admins.
              </div>
            </div>
            <button
              onClick={() => updateApprovalMode(!manualAdminApproval)}
              disabled={savingApprovalMode}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                manualAdminApproval ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {savingApprovalMode
                ? "Saving..."
                : manualAdminApproval
                  ? "ON (Manual approval)"
                  : "OFF (Auto approval)"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">All Admins</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {allAdmins.map((ad) => (
              <div key={ad._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
                <div className="font-semibold">{ad.username}</div>
                <div className="text-slate-600 text-xs">
                  Status: {ad.status}
                  {ad.suspendReason ? ` (${ad.suspendReason})` : ""}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-medium">Admin ID:</span>
                  <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    {ad._id}
                  </code>
                  <button
                    onClick={() => copyAdminId(ad._id)}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100"
                  >
                    {copiedAdminId === ad._id ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="text-slate-600 text-xs">Load: {ad.loadShedding ? "ON" : "OFF"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ad.status === "suspended" ? (
                    <button
                      onClick={() => unsuspendAdmin(ad._id)}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendAdmin(ad._id)}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => deleteAdmin(ad._id)}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {allAdmins.length === 0 && <div className="text-sm text-slate-500">No admins.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">All Users</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {allUsers.map((u) => (
              <div key={u._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
                <div className="font-semibold">{u.username}</div>
                <div className="text-slate-600 text-xs">Admin: {u.adminName ?? u.adminId}</div>
                <div className="text-slate-600 text-xs">
                  Status: {u.status ?? "active"}
                  {u.suspendReason ? ` (${u.suspendReason})` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {u.status === "suspended" ? (
                    <button
                      onClick={() => unsuspendUser(u._id)}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendUser(u._id)}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(u._id)}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {allUsers.length === 0 && <div className="text-sm text-slate-500">No users.</div>}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-600">Create Admin</div>
            <input
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="username"
              value={newAdmin.username}
              onChange={(e) => setNewAdmin((p) => ({ ...p, username: e.target.value }))}
            />
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="password (min 6)"
              value={newAdmin.password}
              onChange={(e) => setNewAdmin((p) => ({ ...p, password: e.target.value }))}
            />
            <select
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={newAdmin.status}
              onChange={(e) => setNewAdmin((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="active">active</option>
            </select>
            <button
              onClick={createAdmin}
              className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Create Admin
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-600">Create User</div>
            <input
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="username"
              value={newUser.username}
              onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
            />
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="password (min 6)"
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
            <select
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
              className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              disabled={!newUser.adminId}
            >
              Create User
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Admins</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Load Shedding</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
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
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => deleteAdmin(a._id)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={4}>
                      No admins found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Users</div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">Username</th>
                  <th className="px-2 py-2 text-left">Admin</th>
                  <th className="px-2 py-2 text-left">Available</th>
                  <th className="px-2 py-2 text-left">Motor</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="px-2 py-2">{u.username}</td>
                    <td className="px-2 py-2">{u.adminName ?? u.adminId}</td>
                    <td className="px-2 py-2">{u.availableMinutes} m</td>
                    <td className="px-2 py-2">{u.motorStatus}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => deleteUser(u._id)}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-2 py-3 text-slate-500" colSpan={5}>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-4xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
