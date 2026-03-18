"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import useRealtime from "@/hooks/useRealtime";

type MotorStatus = "OFF" | "RUNNING" | "HOLD";
type MinuteReqStatus = "pending" | "approved" | "declined";
type UserStatus = "active" | "suspended";

type RealtimePayload = {
  userId?: string;
  motorStatus: MotorStatus;
  remainingMinutes: number;
  availableMinutes?: number;
  loadShedding: boolean;
  deviceReady?: boolean;
  adminStatus?: UserStatus;
  userStatus?: UserStatus;
  holdReason?: "loadshedding" | "device_not_ready" | "admin_suspended" | "user_suspended" | null;
  queuePosition?: number | null;
  runningUser?: string | null;
  estimatedWait?: number | null;
  cardModeActive?: boolean;
  cardModeMessage?: string | null;
  cardActiveUser?: string | null;
};

type UserMePayload = {
  userId?: string;
  availableMinutes?: number;
  queuePosition?: number | null;
  adminName?: string;
  username?: string;
  status?: UserStatus;
  suspendReason?: string | null;
  adminStatus?: UserStatus;
  adminReason?: string | null;
  loadShedding?: boolean;
  deviceReady?: boolean;
};

type MinuteRequestItem = {
  status?: MinuteReqStatus;
  minutes?: number;
};

const statusColors: Record<MotorStatus, string> = {
  RUNNING: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  HOLD: "bg-amber-100 text-amber-800 border border-amber-200",
  OFF: "bg-gray-200 text-gray-700 border border-gray-300",
};

const cardClass = "rounded-2xl border border-gray-200 bg-white shadow-sm p-4";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [setMinutes, setSetMinutes] = useState(10);
  const [availableMinutes, setAvailableMinutes] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [adminName, setAdminName] = useState<string>("-");
  const [userName, setUserName] = useState<string>("-");
  const [optimisticStatus, setOptimisticStatus] = useState<MotorStatus | null>(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState<number | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestMinutes, setRequestMinutes] = useState(10);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ minutes: number; status: MinuteReqStatus } | null>(null);
  const [localQueueCleared, setLocalQueueCleared] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus>("active");
  const [userReason, setUserReason] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<UserStatus>("active");
  const [adminReason, setAdminReason] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const [internetOnline, setInternetOnline] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  const role = session?.user?.role;
  const isUser = role === "user";
  const ADMIN_ID = isUser ? session?.user?.adminId ?? "" : "";
  const SESSION_USER_ID = isUser ? session?.user?.id ?? "" : "";
  const USER_ID = resolvedUserId ?? SESSION_USER_ID;
  const idsValid =
    ADMIN_ID.length === 24 &&
    USER_ID.length === 24 &&
    /^[a-fA-F0-9]+$/.test(ADMIN_ID) &&
    /^[a-fA-F0-9]+$/.test(USER_ID);

  const { loading, data, error } = useRealtime<RealtimePayload>({
    url: `/api/esp32/poll?adminId=${ADMIN_ID}&userId=${USER_ID}`,
    enabled: idsValid && isUser,
  });

  const motorStatus = data?.motorStatus ?? "OFF";
  const remainingMinutes = data?.remainingMinutes ?? 0;
  const availableMinutesLive = data?.availableMinutes;
  const realtimeUserId = data?.userId;
  const loadShedding = data?.loadShedding ?? false;
  const realtimeDeviceReady = data?.deviceReady;
  const queuePositionLive = data?.queuePosition;
  const runningUser = data?.runningUser ?? null;
  const cardModeActive = Boolean(data?.cardModeActive);
  const cardModeMessage = data?.cardModeMessage || "Now using card";
  const cardActiveUser = data?.cardActiveUser ?? null;
  const lowBalance = availableMinutes < 5;
  const estimatedWait = data?.estimatedWait ?? null;
  const queueValue = localQueueCleared ? null : queuePositionLive ?? queuePosition;
  const effectiveStatus = optimisticStatus ?? motorStatus;
  const effectiveRemaining = optimisticRemaining ?? remainingMinutes;
  const showQueueCards = queueValue !== null && queueValue !== undefined && queueValue !== 0;
  const isSuspendedUser = userStatus === "suspended";
  const isSuspendedAdmin = adminStatus === "suspended";
  const suspendedReason = isSuspendedUser
    ? userReason || "You are suspended."
    : isSuspendedAdmin
      ? adminReason || "You are suspended by admin/master."
      : null;
  const effectiveDeviceReady = realtimeDeviceReady ?? deviceReady;
  const displayLoadShedding = loadShedding || effectiveDeviceReady === false;
  const displayInternetOnline = internetOnline && effectiveDeviceReady !== false;
  const runGateOk = !loadShedding && effectiveDeviceReady !== false && internetOnline;
  const displayStatus: MotorStatus = runGateOk ? effectiveStatus : "HOLD";
  const cardModeBlocked = cardModeActive;

  useEffect(() => {
    if (data?.motorStatus !== undefined) {
      setOptimisticStatus(null);
      setOptimisticRemaining(null);
    }
    // Only trust realtime wallet after canonical user id is resolved from /api/user/me.
    // This prevents stale session ids from overwriting wallet with another user's value.
    if (
      typeof availableMinutesLive === "number" &&
      typeof realtimeUserId === "string" &&
      typeof resolvedUserId === "string" &&
      realtimeUserId === resolvedUserId
    ) {
      setAvailableMinutes(availableMinutesLive);
    }
    if (data && "queuePosition" in data) {
      setLocalQueueCleared(false);
    }
  }, [data, availableMinutesLive, realtimeUserId, resolvedUserId]);

  useEffect(() => {
    if (session?.user?.username) setUserName(session.user.username);
  }, [session]);

  useEffect(() => {
    const load = async () => {
      if (sessionStatus !== "authenticated" || !isUser) return;

      try {
        const res = await fetch("/api/user/me", {
          cache: "no-store",
          credentials: "include",
        });
        const json = (await res.json()) as UserMePayload;

        if (res.ok) {
          if (json.userId && /^[a-fA-F0-9]{24}$/.test(json.userId)) {
            setResolvedUserId(json.userId);
          }
          setAvailableMinutes(json.availableMinutes ?? 0);
          setQueuePosition(json.queuePosition ?? null);
          setAdminName(json.adminName ?? "-");
          setUserName(json.username ?? "-");
          setUserStatus(json.status ?? "active");
          setUserReason(json.suspendReason ?? null);
          setAdminStatus(json.adminStatus ?? "active");
          setAdminReason(json.adminReason ?? null);
          setDeviceReady(json.deviceReady ?? null);
        }
      } catch {
        // ignore
      }

      try {
        const requestUrl = "/api/user/minute-request";
        let resReq = await fetch(requestUrl, {
          cache: "no-store",
          credentials: "include",
        });

        // During fresh page/session hydration, auth cookie can be delayed briefly.
        // Retry once to avoid noisy first 401 while keeping auth rules unchanged.
        if (resReq.status === 401) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          resReq = await fetch(requestUrl, {
            cache: "no-store",
            credentials: "include",
          });
        }

        if (resReq.ok) {
          const json = (await resReq.json()) as { requests?: MinuteRequestItem[] };
          const pending = json.requests?.find((req) => req.status === "pending");

          if (pending) {
            const minutes = pending.minutes ?? 0;
            setPendingRequest({ minutes, status: "pending" });
            setRequestMessage(`Pending approval: ${minutes}m`);
            setShowRequest(true);
          } else {
            setPendingRequest(null);
            setRequestMessage(null);
          }
        }
      } catch {
        // ignore
      }
    };

    load();
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, [isUser, sessionStatus, ADMIN_ID, USER_ID]);

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

  const handleStart = async () => {
    if (!idsValid) return;

    setRequestError(null);
    if (!internetOnline) {
      setRequestError("Internet offline. Motor start is blocked.");
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

      const startResult = (await res.json()) as { status: "RUNNING" | "WAITING"; queuePosition?: number };
      setQueuePosition(startResult.status === "WAITING" ? startResult.queuePosition ?? null : 0);
      setLocalQueueCleared(false);

      if (startResult.status === "RUNNING") {
        setOptimisticStatus("RUNNING");
        setOptimisticRemaining(setMinutes);
      }
    } catch (err) {
      setRequestError(getErrorMessage(err, "Failed to start motor"));
    } finally {
      setStartLoading(false);
    }
  };

  const handleStop = async () => {
    if (!idsValid) return;

    setRequestError(null);
    setStopLoading(true);

    try {
      const res = await fetch("/api/motor/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to stop motor");
      }

      await res.json();
      setQueuePosition(null);
      setOptimisticStatus("OFF");
      setOptimisticRemaining(0);
      setLocalQueueCleared(true);
      router.refresh();
    } catch (err) {
      setRequestError(getErrorMessage(err, "Failed to stop motor"));
    } finally {
      setStopLoading(false);
    }
  };

  const gateView =
    sessionStatus === "unauthenticated" ? (
      <div className="min-h-screen bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">Please sign in to view your dashboard.</p>
          <button
            onClick={() => router.push("/user/login")}
            className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to Login
          </button>
        </div>
      </div>
    ) : sessionStatus === "authenticated" && !isUser ? (
      <div className="min-h-screen bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold">This dashboard is for users only.</p>
          <p className="mt-2 text-sm text-slate-600">Please sign in with a user account.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => signOut({ callbackUrl: "/user/login" })}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign out
            </button>
            <button
              onClick={() => router.push("/user/login")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
            >
              User Login
            </button>
          </div>
        </div>
      </div>
    ) : null;

  if (gateView) return gateView;

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto mt-2 flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-600">PumpPilot</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">User Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              User: <span className="font-semibold text-slate-900">{userName}</span>
            </p>
            <p className="text-sm text-slate-600">
              Admin: <span className="font-semibold text-slate-900">{adminName}</span>
            </p>
          </div>
          <div />
        </header>

        {suspendedReason && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            You are suspended: {suspendedReason}
          </div>
        )}

        {!suspendedReason && lowBalance && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your balance is below 5 minutes. Please recharge.
          </div>
        )}

        {cardModeActive && (
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 px-5 py-4 text-center shadow-sm">
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <span className="text-sm font-bold">RF</span>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                Card Mode
              </div>
              <div className="text-base font-semibold text-indigo-900">
                {cardModeMessage}
              </div>
              {cardActiveUser && (
                <div className="text-xs text-indigo-600">
                  Card user: <span className="font-semibold">{cardActiveUser}</span>
                </div>
              )}
              <div className="text-xs text-indigo-600">
                Dashboard controls are locked while the card is active.
              </div>
            </div>
          </div>
        )}

        {loadShedding && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Load shedding active now. Motor is on HOLD until power resumes.
          </div>
        )}

        {!suspendedReason &&
          !loadShedding &&
          effectiveDeviceReady === false &&
          data?.holdReason === "device_not_ready" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your device is not ready.
          </div>
          )}

        {!internetOnline && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Internet is offline. Motor remains on HOLD until connection is restored.
          </div>
        )}

        {requestError && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {requestError}
          </div>
        )}

        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">System Readiness</div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              Device:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${effectiveDeviceReady === false ? "text-red-700" : "text-emerald-700"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${effectiveDeviceReady === false ? "bg-red-500" : "bg-emerald-500"}`} />
                {effectiveDeviceReady === false ? "Not Ready" : "Ready"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              Loadshedding:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${displayLoadShedding ? "text-red-700" : "text-emerald-700"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${displayLoadShedding ? "bg-red-500" : "bg-emerald-500"}`} />
                {displayLoadShedding ? "Yes" : "No"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              Internet:{" "}
              <span className={`inline-flex items-center gap-1.5 font-semibold ${displayInternetOnline ? "text-emerald-700" : "text-red-700"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${displayInternetOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                {displayInternetOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard title="Motor Status" value={displayStatus} status={displayStatus} />
          <InfoCard title="Remaining Minutes" value={`${effectiveRemaining}m`} />
          <InfoCard title="Available Minutes" value={`${availableMinutes}m`} />

          {showQueueCards && (
            <>
              <InfoCard title="Running User" value={effectiveStatus === "RUNNING" ? "You" : runningUser || "-"} />
              <InfoCard title="Est. Wait" value={queueValue && queueValue > 0 ? `${estimatedWait ?? "-"}m` : "-"} subtle />
              <InfoCard
                title="Queue Position"
                value={
                  queueValue === null || queueValue === undefined
                    ? "Not queued"
                    : queueValue === 0
                      ? "Running"
                      : `#${queueValue}`
                }
              />
              <InfoCard
                title="Queue Awareness"
                value={
                  queueValue === null || queueValue === undefined
                    ? "No queue"
                    : queueValue === 0
                      ? "You are running"
                      : `You are #${queueValue}`
                }
                subtle
              />
            </>
          )}

          {pendingRequest && <InfoCard title="Request Minutes" value={`Pending approval: ${pendingRequest.minutes}m`} subtle />}
        </div>

        {!cardModeBlocked && (
          <div className="flex flex-col items-center gap-4">
            <div
              className={`w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-md ${
                loadShedding || suspendedReason || effectiveDeviceReady === false || !internetOnline ? "pointer-events-none opacity-60" : ""
              }`}
            >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Set Minutes</div>
                <div className="text-lg font-semibold text-slate-900">Configure your run time</div>
              </div>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-slate-600">Wallet: {availableMinutes}m</span>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-0 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                value={setMinutes}
                onChange={(event) => setSetMinutes(Math.max(1, Number(event.target.value)))}
              />
              <div className="flex w-full flex-1 items-center gap-3">
                <button
                  onClick={handleStart}
                  className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    effectiveStatus === "RUNNING" ||
                    ((queuePositionLive ?? queuePosition) ?? 0) > 0 ||
                    loadShedding ||
                    effectiveDeviceReady === false ||
                    !internetOnline ||
                    lowBalance ||
                    suspendedReason !== null ||
                    cardModeBlocked ||
                    startLoading ||
                    !idsValid
                  }
                >
                  {startLoading ? "Starting..." : "Start Motor"}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={stopLoading || !idsValid || suspendedReason !== null || cardModeBlocked}
                >
                  {stopLoading ? "Stopping..." : "Stop Motor"}
                </button>
              </div>
            </div>

            {effectiveStatus === "RUNNING" && !loadShedding && !cardModeBlocked && (
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

                      const json = (await res.json()) as { error?: string; availableMinutes?: number };
                      if (!res.ok) throw new Error(json.error || "Failed to add minutes");

                      setAvailableMinutes(json.availableMinutes ?? availableMinutes - 1);
                      setOptimisticRemaining((previous) => (previous ?? effectiveRemaining) + 1);
                    } catch (err) {
                      setExtendError(getErrorMessage(err, "Failed to add minutes"));
                    } finally {
                      setExtendLoading(false);
                    }
                  }}
                  disabled={extendLoading || availableMinutes <= 0 || lowBalance || suspendedReason !== null || cardModeBlocked}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600 disabled:opacity-50"
                >
                  {extendLoading ? "Adding..." : "+ Add 1 minute"}
                </button>
                {extendError && <div className="mt-2 text-xs text-red-600">Extend error: {extendError}</div>}
              </div>
            )}
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
          <button
            onClick={() => setShowRequest((show) => !show)}
            className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#1e4fbf]"
          >
            {showRequest ? "Hide Buy Minutes" : "Buy Minutes"}
          </button>
        </div>

        {showRequest && (
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
            <div className="text-sm text-slate-600">Request more minutes</div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={requestMinutes}
                onChange={(event) => setRequestMinutes(Math.max(1, Number(event.target.value)))}
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

                    const json = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(json.error || "Request failed");

                    setPendingRequest({ minutes: requestMinutes, status: "pending" });
                    setRequestMessage("Request sent - wait for admin approval");
                  } catch (err) {
                    setRequestError(getErrorMessage(err, "Failed to send request"));
                  } finally {
                    setRequestLoading(false);
                  }
                }}
                disabled={requestLoading || requestMinutes <= 0 || suspendedReason !== null || Boolean(pendingRequest)}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-400 disabled:opacity-60"
              >
                {requestLoading ? "Sending..." : "Send Request"}
              </button>
            </div>
            {requestError && <p className="mt-2 text-xs text-red-600">{requestError}</p>}
            {requestMessage && <p className="mt-2 text-xs text-emerald-600">{requestMessage}</p>}

          </div>
        )}

        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">Session Controls</div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              {idsValid ? "Live status ready" : "Missing Admin/User IDs"}
              {loading ? " | syncing..." : ""}
              {error ? " | realtime degraded" : ""}
            </div>
            {sessionStatus === "authenticated" && (
              <div className="flex items-center gap-2">
                <a
                  href="/api/history?format=csv&download=1&limit=100"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
                >
                  Download History
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: "/user/login" })}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
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
    <div className={cardClass}>
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold">
        {status === "RUNNING" ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[status]}`}>{value}</span>
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
    <div className={cardClass}>
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-3 text-xl font-semibold ${subtle ? "text-slate-500" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
