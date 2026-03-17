"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type AdminRow = {
  _id: string;
  username: string;
  status: string;
  loadShedding?: boolean;
  deviceReady?: boolean;
  deviceOnline?: boolean;
  devicePinHigh?: boolean;
  suspendReason?: string;
};
type UserRow = { _id: string; username: string; adminId: string; adminName?: string; rfidUid?: string; availableMinutes: number; motorStatus: string; motorRunningTime?: number; status?: string; suspendReason?: string };
type UserWithAdmin = { _id: string; username: string; adminId: string; adminName?: string; rfidUid?: string; availableMinutes?: number; motorStatus?: string; motorRunningTime?: number; status?: string; suspendReason?: string };

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
  const [minuteDrafts, setMinuteDrafts] = useState<Record<string, string>>({});
  const [manualAdminApproval, setManualAdminApproval] = useState(true);
  const [savingApprovalMode, setSavingApprovalMode] = useState(false);
  const [rfidTarget, setRfidTarget] = useState("");
  const [rfidUid, setRfidUid] = useState("");
  const [rfidLoading, setRfidLoading] = useState(false);
  const [rfidMessage, setRfidMessage] = useState<string | null>(null);

  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", status: "pending" });
  const [newUser, setNewUser] = useState({ username: "", password: "", adminId: "" });
  const [internetOnline, setInternetOnline] = useState(true);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnline = () => setInternetOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

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

  const rechargeUserMinutes = async (id: string, minutes: number) => {
    setError(null);
    const res = await fetch("/api/master/users/minutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, action: "recharge", minutes }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Recharge failed");
    loadData();
  };

  const setUserAvailableMinutes = async (id: string, minutes: number) => {
    setError(null);
    const res = await fetch("/api/master/users/minutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, action: "set", minutes }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Set available minutes failed");
    loadData();
  };

  const startUserMotor = async (id: string, requestedMinutes?: number) => {
    setError(null);
    const res = await fetch("/api/master/users/motor-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, action: "start", requestedMinutes }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Start motor failed");
    loadData();
  };

  const stopResetUserMotor = async (id: string) => {
    setError(null);
    const res = await fetch("/api/master/users/motor-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, action: "stop_reset" }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Stop/reset failed");
    loadData();
  };

  const assignRfid = async (clearOnly = false) => {
    setError(null);
    setRfidMessage(null);
    setRfidLoading(true);
    try {
      const payload = { userId: rfidTarget, rfidUid: clearOnly ? null : rfidUid.trim() };
      const res = await fetch("/api/master/users/rfid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "RFID update failed");
      if (clearOnly) {
        setRfidMessage("RFID cleared");
        setRfidUid("");
      } else {
        setRfidMessage("RFID assigned");
      }
      loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "RFID update failed");
    } finally {
      setRfidLoading(false);
    }
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
              Master Admin: {session?.user?.username || "-"}
            </p>
            <p className="text-sm text-slate-600">Create, approve, suspend and delete admins and users.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/history?format=csv&download=1&limit=100"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Download History
            </a>
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
                {(() => {
                  const displayLoadShedding = Boolean(ad.loadShedding) || ad.deviceReady === false;
                  const displayInternetOnline =
                    internetOnline && ad.deviceReady !== false && ad.deviceOnline !== false;
                  return (
                    <div className="mt-2 grid gap-1 text-xs">
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                        Device:{" "}
                        <span className={`inline-flex items-center gap-1 font-semibold ${ad.deviceReady === false ? "text-red-700" : "text-emerald-700"}`}>
                          <span className={`h-2 w-2 rounded-full ${ad.deviceReady === false ? "bg-red-500" : "bg-emerald-500"}`} />
                          {ad.deviceReady === false ? "Not Ready" : "Ready"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                        Loadshedding:{" "}
                        <span className={`inline-flex items-center gap-1 font-semibold ${displayLoadShedding ? "text-red-700" : "text-emerald-700"}`}>
                          <span className={`h-2 w-2 rounded-full ${displayLoadShedding ? "bg-red-500" : "bg-emerald-500"}`} />
                          {displayLoadShedding ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                        Internet:{" "}
                        <span className={`inline-flex items-center gap-1 font-semibold ${displayInternetOnline ? "text-emerald-700" : "text-red-700"}`}>
                          <span className={`h-2 w-2 rounded-full ${displayInternetOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                          {displayInternetOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
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
                <div className="text-slate-600 text-xs">RFID: {u.rfidUid || "-"}</div>
                <div className="text-slate-600 text-xs">Balance: {u.availableMinutes ?? 0} m</div>
                <div className="text-slate-600 text-xs">Motor: {u.motorStatus ?? "OFF"}</div>
                <div className="text-slate-600 text-xs">Running Time: {u.motorRunningTime ?? 0} m</div>
                <div className="text-slate-600 text-xs">
                  Status: {u.status ?? "active"}
                  {u.suspendReason ? ` (${u.suspendReason})` : ""}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min={0}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    placeholder="minutes"
                    value={minuteDrafts[u._id] ?? String(u.availableMinutes ?? 0)}
                    onChange={(e) =>
                      setMinuteDrafts((prev) => ({ ...prev, [u._id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => {
                      const value = Number(minuteDrafts[u._id] ?? u.availableMinutes ?? 0);
                      if (!Number.isFinite(value) || value <= 0) return setError("Recharge minutes must be > 0");
                      rechargeUserMinutes(u._id, value);
                    }}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                  >
                    Recharge
                  </button>
                  <button
                    onClick={() => {
                      const value = Number(minuteDrafts[u._id] ?? u.availableMinutes ?? 0);
                      if (!Number.isFinite(value) || value < 0) return setError("Set minutes must be >= 0");
                      setUserAvailableMinutes(u._id, Math.floor(value));
                    }}
                    className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                  >
                    Set Balance
                  </button>
                  <button
                    onClick={() => startUserMotor(u._id, u.motorRunningTime && u.motorRunningTime > 0 ? u.motorRunningTime : 5)}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                  >
                    Start Motor
                  </button>
                  <button
                    onClick={() => stopResetUserMotor(u._id)}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-800 hover:bg-slate-200"
                  >
                    Stop/Reset
                  </button>
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

        <section className="grid gap-4 lg:grid-cols-3">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-600">RFID Card Registration</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={rfidTarget}
                onChange={(e) => setRfidTarget(e.target.value)}
              >
                <option value="">Select user</option>
              {allUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.username}
                  {u.rfidUid ? ` [${u.rfidUid}]` : ""}
                  {` (${u.adminName ?? u.adminId})`}
                </option>
              ))}
            </select>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 uppercase"
                placeholder="RFID UID (UPPERCASE)"
                value={rfidUid}
                onChange={(e) => setRfidUid(e.target.value.toUpperCase())}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => assignRfid(false)}
                disabled={rfidLoading || !rfidTarget || !rfidUid.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {rfidLoading ? "Assigning..." : "Assign"}
              </button>
              <button
                onClick={() => assignRfid(true)}
                disabled={rfidLoading || !rfidTarget}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Clear
              </button>
              {rfidMessage && <span className="self-center text-xs text-emerald-600">{rfidMessage}</span>}
            </div>
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
