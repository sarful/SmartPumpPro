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
type UserRow = { _id: string; username: string; adminId: string; adminName?: string; rfidUid?: string; availableMinutes: number; motorStatus: string; motorRunningTime?: number; status?: string; suspendReason?: string; useSource?: string };
type UserWithAdmin = { _id: string; username: string; adminId: string; adminName?: string; rfidUid?: string; availableMinutes?: number; motorStatus?: string; motorRunningTime?: number; status?: string; suspendReason?: string; useSource?: string };

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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="/api/history?format=csv&download=1&limit=100"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Download History
            </a>
            <a
              href="/master/change-password"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Change Password
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Logout
            </button>
          </div>
        </header>

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
          onMinuteDraftChange={(userId, value) =>
            setMinuteDrafts((prev) => ({ ...prev, [userId]: value }))
          }
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
