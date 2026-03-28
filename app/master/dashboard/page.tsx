"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { DashboardMessage } from "@/components/DashboardMessage";
import { getErrorMessage } from "@/lib/error-message";
import { MasterAdminsSection } from "@/components/master/MasterAdminsSection";
import { MasterApprovalControl } from "@/components/master/MasterApprovalControl";
import { MasterManagementForms } from "@/components/master/MasterManagementForms";
import { MasterStatsGrid } from "@/components/master/MasterStatsGrid";
import { MasterUsersSection } from "@/components/master/MasterUsersSection";

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
type UserRow = {
  _id: string;
  username: string;
  adminId: string;
  adminName?: string;
  rfidUid?: string;
  availableMinutes: number;
  motorStatus: string;
  motorRunningTime?: number;
  status?: string;
  suspendReason?: string;
  useSource?: string;
};
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

  const loadData = async (options?: { silent?: boolean }) => {
    if (!isMaster) return;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
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
    } catch (err) {
      if (!silent) {
        setError(getErrorMessage(err, "Failed to load data"));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const updateApprovalMode = async (value: boolean) => {
    setSavingApprovalMode(true);
    setError(null);
    const nextLabel = value ? "manual approval" : "auto approval";
    if (!window.confirm(`Switch admin approval mode to ${nextLabel}?`)) {
      setSavingApprovalMode(false);
      return;
    }
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
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update approval mode"));
    } finally {
      setSavingApprovalMode(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isMaster) loadData();
  }, [status, isMaster]);

  useEffect(() => {
    if (status !== "authenticated" || !isMaster) return;
    const intervalId = setInterval(() => {
      loadData({ silent: true });
    }, 5000);
    return () => clearInterval(intervalId);
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
    if (!window.confirm("Delete this admin permanently?")) return;
    const res = await fetch(`/api/master/admins/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Delete admin failed");
    loadData();
  };

  const suspendAdmin = async (id: string) => {
    setError(null);
    if (!window.confirm("Suspend this admin?")) return;
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
    if (!window.confirm("Delete this user permanently?")) return;
    const res = await fetch(`/api/master/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Delete user failed");
    loadData();
  };

  const suspendUser = async (id: string) => {
    setError(null);
    if (!window.confirm("Suspend this user?")) return;
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
    if (!window.confirm("Stop and reset this user's motor session?")) return;
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
    } catch (err) {
      setError(getErrorMessage(err, "RFID update failed"));
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#ffffff_38%,_#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">PumpPilot Control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Master Dashboard</h1>
              <p className="mt-3 text-sm text-slate-600 sm:text-base">
                Central command for admins, users, balances, RFID assignment, and system oversight.
              </p>
              <p className="mt-2 text-sm text-slate-500">Master Admin: {session?.user?.username || "-"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/history?format=csv&download=1&limit=100"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                Download History
              </a>
              <a
                href="/master/change-password"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                Change Password
              </a>
              <button
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="flex flex-col gap-6">
            {loading ? (
              <DashboardMessage
                variant="info"
                title="Loading dashboard"
                message="We are syncing admins, users, approval state, and system controls."
              />
            ) : null}

            {error ? <DashboardMessage variant="error" title="Dashboard error" message={error} actionLabel="Retry" onAction={loadData} /> : null}

            {overview ? <MasterStatsGrid overview={overview} /> : null}

            <MasterApprovalControl
              manualAdminApproval={manualAdminApproval}
              savingApprovalMode={savingApprovalMode}
              onToggle={() => updateApprovalMode(!manualAdminApproval)}
            />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live Summary</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">System Snapshot</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Connectivity</div>
                <div className={`mt-2 text-sm font-semibold ${internetOnline ? "text-emerald-700" : "text-red-700"}`}>
                  {internetOnline ? "Browser Online" : "Browser Offline"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Admin Approval</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {manualAdminApproval ? "Manual approval enabled" : "Auto approval enabled"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Operational Focus</div>
                <div className="mt-2 text-sm text-slate-600">
                  Approve admins, manage balances, assign RFID cards, and supervise live motor activity.
                </div>
              </div>
            </div>
          </section>
        </section>

        <MasterAdminsSection
          admins={allAdmins}
          copiedAdminId={copiedAdminId}
          internetOnline={internetOnline}
          onCopyAdminId={copyAdminId}
          onSuspendAdmin={suspendAdmin}
          onUnsuspendAdmin={unsuspendAdmin}
          onDeleteAdmin={deleteAdmin}
        />

        <MasterUsersSection
          users={allUsers}
          minuteDrafts={minuteDrafts}
          onMinuteDraftChange={(userId, value) => setMinuteDrafts((prev) => ({ ...prev, [userId]: value }))}
          onRechargeUserMinutes={rechargeUserMinutes}
          onSetUserAvailableMinutes={setUserAvailableMinutes}
          onStartUserMotor={startUserMotor}
          onStopResetUserMotor={stopResetUserMotor}
          onSuspendUser={suspendUser}
          onUnsuspendUser={unsuspendUser}
          onDeleteUser={deleteUser}
          onSetError={setError}
        />

        <MasterManagementForms
          newAdmin={newAdmin}
          onNewAdminChange={setNewAdmin}
          onCreateAdmin={createAdmin}
          newUser={newUser}
          admins={admins}
          onNewUserChange={setNewUser}
          onCreateUser={createUser}
          rfidTarget={rfidTarget}
          rfidUid={rfidUid}
          allUsers={allUsers}
          rfidLoading={rfidLoading}
          rfidMessage={rfidMessage}
          onRfidTargetChange={setRfidTarget}
          onRfidUidChange={setRfidUid}
          onAssignRfid={assignRfid}
        />
      </div>
    </div>
  );
}
