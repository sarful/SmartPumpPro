"use client";

import { useMemo, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useRealtime from "@/hooks/useRealtime";

type MotorStatus = "OFF" | "RUNNING" | "HOLD";
type MinuteReqStatus = "pending" | "approved" | "declined";

const statusColors: Record<MotorStatus, string> = {
  RUNNING: "bg-emerald-500 text-emerald-50",
  HOLD: "bg-amber-500 text-amber-50",
  OFF: "bg-slate-500 text-slate-50",
};

export default function UserDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [setMinutes, setSetMinutes] = useState(10);
  const [availableMinutes, setAvailableMinutes] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [adminName, setAdminName] = useState<string>("...");
  const [userName, setUserName] = useState<string>("User");
  const [optimisticStatus, setOptimisticStatus] = useState<MotorStatus | null>(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState<number | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestMinutes, setRequestMinutes] = useState(10);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ minutes: number; status: MinuteReqStatus } | null>(null);
  const [userStatus, setUserStatus] = useState<"active" | "suspended">("active");
  const [userReason, setUserReason] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<"active" | "suspended">("active");
  const [adminReason, setAdminReason] = useState<string | null>(null);

  const role = session?.user?.role;
  const isUser = role === "user";
  const ADMIN_ID = isUser ? session?.user?.adminId ?? "" : "";
  const USER_ID = isUser ? session?.user?.id ?? "" : "";
  const idsValid =
    ADMIN_ID.length === 24 &&
    USER_ID.length === 24 &&
    /^[a-fA-F0-9]+$/.test(ADMIN_ID) &&
    /^[a-fA-F0-9]+$/.test(USER_ID);

  const { loading, data, error } = useRealtime<{
    motorStatus: MotorStatus;
    remainingMinutes: number;
    loadShedding: boolean;
    queuePosition?: number;
    runningUser?: string | null;
    estimatedWait?: number | null;
  }>({
    url: `/api/esp32/poll?adminId=${ADMIN_ID}&userId=${USER_ID}`,
    enabled: idsValid && isUser,
  });

  const motorStatus = data?.motorStatus ?? "OFF";
  const remainingMinutes = data?.remainingMinutes ?? 0;
  const loadShedding = data?.loadShedding ?? false;
  const queuePositionLive = data?.queuePosition;
  const runningUser = data?.runningUser ?? null;
  const lowBalance = availableMinutes < 5;
  const estimatedWait = data?.estimatedWait ?? null;
  const queueValue = queuePositionLive ?? queuePosition;
  const hasQueue = queueValue !== null && queueValue !== undefined;
  const effectiveStatus = optimisticStatus ?? motorStatus;
  const effectiveRemaining = optimisticRemaining ?? remainingMinutes;
  const isSuspendedUser = userStatus === "suspended";
  const isSuspendedAdmin = adminStatus === "suspended";
  const suspendedReason = isSuspendedUser
    ? userReason || "Your account is suspended."
    : isSuspendedAdmin
      ? adminReason || "Your admin has been suspended."
      : null;

  // Clear optimistic when real data arrives
  useEffect(() => {
    if (data?.motorStatus !== undefined) {
      setOptimisticStatus(null);
      setOptimisticRemaining(null);
    }
  }, [data?.motorStatus, data?.remainingMinutes]);

  const statusLabel = useMemo(() => effectiveStatus, [effectiveStatus]);

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">Please sign in to view your dashboard.</p>
          <button
            onClick={() => router.push("/user/login")}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (sessionStatus === "authenticated" && !isUser) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">This dashboard is for Users only.</p>
          <p className="mt-2 text-sm text-slate-300">Please sign in with a user account.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => signOut({ callbackUrl: "/user/login" })}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Sign out
            </button>
            <button
              onClick={() => router.push("/user/login")}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-cyan-400 hover:text-cyan-200"
            >
              User Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Load wallet/queue info
  useEffect(() => {
    const load = async () => {
      if (!idsValid) return;
      try {
        const res = await fetch("/api/user/me", { cache: "no-store" });
        const json = await res.json();
        if (res.ok) {
          setAvailableMinutes(json.availableMinutes ?? 0);
          setQueuePosition(json.queuePosition ?? null);
          setAdminName(json.adminName ?? "Admin");
          setUserName(json.username ?? "User");
          setUserStatus(json.status ?? "active");
          setUserReason(json.suspendReason ?? null);
          setAdminStatus(json.adminStatus ?? "active");
          setAdminReason(json.adminReason ?? null);
        }
      } catch {
        // ignore
      }

      // Load recent minute requests
      try {
        const resReq = await fetch("/api/user/minute-request", { cache: "no-store" });
        if (resReq.ok) {
          const jr = await resReq.json();
          const pending = (jr.requests as any[])?.find((r) => r.status === "pending");
          if (pending) {
            setPendingRequest({ minutes: pending.minutes ?? 0, status: "pending" });
            setRequestMessage(`Pending approval: ${pending.minutes}m`);
          } else {
            setPendingRequest(null);
          }
        }
      } catch {
        // ignore
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [idsValid]);

  const handleStart = async () => {
    setStartError(null);
    if (!idsValid) {
      setStartError("Missing or invalid session IDs");
      return;
    }
    setStartLoading(true);
    try {
      const res = await fetch("/api/motor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, requestedMinutes: setMinutes }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to start motor");
      }
      const data: { status: "RUNNING" | "WAITING"; queuePosition?: number } = await res.json();
      setQueuePosition(data.status === "WAITING" ? data.queuePosition ?? null : 0);
      if (data.status === "RUNNING") {
        setOptimisticStatus("RUNNING");
        setOptimisticRemaining(setMinutes);
      }
    } catch (err: any) {
      setStartError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStartLoading(false);
    }
  };

  const handleStop = () => {
    setStopError(null);
    if (!idsValid) {
      setStopError("Missing or invalid session IDs");
      return;
    }
    setStopLoading(true);
    fetch("/api/motor/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to stop motor");
        }
        await res.json();
        router.refresh();
        setOptimisticStatus("OFF");
        setOptimisticRemaining(0);
      })
      .catch((err: any) => {
        setStopError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => setStopLoading(false));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
              SmartPump Pro
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Welcome, {userName}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Admin: <span className="font-semibold text-slate-100">{adminName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            {idsValid ? "Live status ready for integration" : "Missing Admin/User IDs"}
            {sessionStatus === "authenticated" && (
              <button
                onClick={() => signOut({ callbackUrl: "/user/login" })}
                className="ml-3 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
              >
                Logout
              </button>
            )}
          </div>
        </header>

        {suspendedReason && (
          <div className="rounded-xl border border-red-500/40 bg-red-900/60 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-900/30">
            Account suspended: {suspendedReason}
          </div>
        )}

        {!suspendedReason && lowBalance && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-900/60 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-900/30">
            আপনার পাঁচ মিনিটের কম ব্যালান্স আছে, রিচার্জ করুন।
          </div>
        )}

        {loadShedding && (
          <div className="rounded-xl border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-900/30">
            ⚠️ Load shedding active — motor is paused until power resumes.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard title="Motor Status" value={statusLabel} status={effectiveStatus} />
          <InfoCard title="Remaining Minutes" value={`${effectiveRemaining}m`} />
          <InfoCard title="Available Minutes" value={`${availableMinutes}m`} />
          {hasQueue ? (
            <>
              <InfoCard
                title="Running User"
                value={
                  effectiveStatus === "RUNNING"
                    ? "You"
                    : runningUser
                      ? runningUser
                      : "—"
                }
              />
              <InfoCard
                title="Est. Wait"
                value={
                  queueValue !== null && queueValue !== undefined && queueValue > 0
                    ? `${estimatedWait ?? "—"}m`
                    : "—"
                }
                subtle
              />
              <InfoCard
                title="Queue Position"
                value={
                  queueValue === null
                    ? "Not queued"
                    : queueValue === 0
                      ? "Running"
                      : `#${queueValue}`
                }
              />
              <InfoCard
                title="Queue Awareness"
                value={
                  queueValue === null
                    ? "No queue"
                    : queueValue === 0
                      ? "You are running"
                      : `You are #${queueValue}`
                }
                subtle
              />
            </>
          ) : null}
          <InfoCard
            title="Request Minutes"
            value={
              requestMessage
                ? requestMessage
                : requestLoading
                  ? "Sending..."
                  : `${requestMinutes}m`
            }
            subtle
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div
            className={`rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/40 ${
              loadShedding || suspendedReason ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Set Minutes</div>
                <div className="text-lg font-semibold text-slate-100">
                  Configure your run time
                </div>
              </div>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                Wallet: {availableMinutes}m
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-base text-slate-50 outline-none ring-0 focus:border-cyan-400"
                value={setMinutes}
                onChange={(e) => setSetMinutes(Math.max(1, Number(e.target.value)))}
              />
              <div className="flex w-full flex-1 items-center gap-3">
                <button
                  onClick={handleStart}
                  className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    effectiveStatus === "RUNNING" ||
                    ((queuePositionLive ?? queuePosition) ?? 0) > 0 ||
                    loadShedding ||
                    lowBalance ||
                    suspendedReason !== null ||
                    startLoading ||
                    !idsValid
                  }
                >
                  {startLoading ? "Starting..." : "Start Motor"}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md shadow-slate-950/40 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={effectiveStatus === "OFF" || stopLoading || !idsValid || suspendedReason !== null}
                >
                  {stopLoading ? "Stopping..." : "Stop Motor"}
                </button>
              </div>
            </div>

            {effectiveStatus === "RUNNING" && !loadShedding && (
              <div className="mt-3">
                <button
                  onClick={async () => {
                    setExtendError(null);
                    if (!idsValid) {
                      setExtendError("Missing or invalid session IDs");
                      return;
                    }
                    setExtendLoading(true);
                    try {
                      const res = await fetch("/api/motor/extend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: USER_ID, minutes: 1 }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Failed to add minutes");
                      setAvailableMinutes(json.availableMinutes ?? availableMinutes - 1);
                      setOptimisticRemaining((prev) => (prev ?? effectiveRemaining) + 1);
                    } catch (err: any) {
                      setExtendError(err instanceof Error ? err.message : "Unknown error");
                    } finally {
                      setExtendLoading(false);
                    }
                  }}
                  disabled={
                    extendLoading ||
                    availableMinutes <= 0 ||
                    lowBalance ||
                    suspendedReason !== null
                  }
                  className="rounded-xl border border-cyan-500 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  {extendLoading ? "Adding..." : "+ Add 1 minute"}
                </button>
                {extendError && (
                  <div className="mt-2 text-xs text-red-300">Extend error: {extendError}</div>
                )}
                </div>
              )}

          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/40">
          <div className="text-sm text-slate-300">Request more minutes</div>
          <div className="mt-2 flex gap-3 sm:flex-row flex-col">
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={requestMinutes}
              onChange={(e) => setRequestMinutes(Math.max(1, Number(e.target.value)))}
            />
            <button
              onClick={async () => {
                setRequestError(null);
                setRequestMessage(null);
                setPendingRequest(null);
                if (!idsValid) {
                  setRequestError("Missing or invalid session IDs");
                  return;
                }
                if (pendingRequest) {
                  setRequestError("Request already pending, wait for admin approval.");
                  return;
                }
                setRequestLoading(true);
                try {
                  const res = await fetch("/api/user/minute-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ minutes: requestMinutes }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "Request failed");
                  setPendingRequest({ minutes: requestMinutes, status: "pending" });
                  setRequestMessage("Request sent — wait for admin approval");
                } catch (err: any) {
                  setRequestError(err instanceof Error ? err.message : "Unknown error");
                } finally {
                  setRequestLoading(false);
                }
              }}
              disabled={
                requestLoading ||
                requestMinutes <= 0 ||
                suspendedReason !== null ||
                lowBalance ||
                !!pendingRequest
              }
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-cyan-300 disabled:opacity-60"
            >
              {requestLoading ? "Sending..." : "Send Request"}
            </button>
          </div>
          {requestError && <p className="mt-2 text-xs text-red-300">{requestError}</p>}
          {requestMessage && <p className="mt-2 text-xs text-emerald-300">{requestMessage}</p>}
        </div>
      </div>
    </div>
  );
}

type StatusCardProps = {
  title: string;
  value: string;
  status: MotorStatus;
};

function StatusCard({ title, value, status }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status]}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

type InfoCardProps = {
  title: string;
  value: string;
  subtle?: boolean;
};

function InfoCard({ title, value, subtle }: InfoCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/40">
      <div className="text-sm text-slate-400">{title}</div>
      <div
        className={`mt-3 text-xl font-semibold ${
          subtle ? "text-slate-200" : "text-slate-50"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

