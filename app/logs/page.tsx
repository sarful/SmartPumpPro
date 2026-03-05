"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

type HistoryEntry = {
  _id: string;
  event: string;
  date: string;
  usedMinutes?: number;
  addedMinutes?: number;
  userId?: { username?: string } | string;
  adminId?: { username?: string } | string;
};

const eventLabel: Record<string, string> = {
  motor_start: "Motor Start",
  motor_stop: "Motor Stop",
  recharge: "Recharge",
  attendance: "Attendance",
  hold: "Hold",
  resume: "Resume",
  system_device_ready: "Device Ready",
  system_device_not_ready: "Device Not Ready",
  system_loadshedding_on: "Loadshedding On",
  system_loadshedding_off: "Loadshedding Off",
  system_internet_online: "Internet Online",
  system_internet_offline: "Internet Offline",
};

function resolveName(value: HistoryEntry["userId"] | HistoryEntry["adminId"]) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  return value.username || "-";
}

export default function LogsPage() {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/history?limit=100", { cache: "no-store" });
        const json = (await res.json()) as { entries?: HistoryEntry[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load logs");
        setEntries(json.entries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") load();
  }, [status]);

  if (status === "loading") {
    return <main className="min-h-screen bg-white p-6 text-slate-900">Loading session...</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold">Please login to view history logs.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PumpPilot</p>
            <h1 className="text-2xl font-semibold">Dashboard History Logs</h1>
            <p className="text-sm text-slate-600">Recent system activity (latest 100 records)</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Home
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Admin</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Used</th>
                <th className="px-4 py-3 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>
                    Loading logs...
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>
                    No logs found yet.
                  </td>
                </tr>
              )}
              {!loading &&
                entries.map((entry) => (
                  <tr key={entry._id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3">{new Date(entry.date).toLocaleString()}</td>
                    <td className="px-4 py-3">{eventLabel[entry.event] || entry.event}</td>
                    <td className="px-4 py-3">{resolveName(entry.adminId)}</td>
                    <td className="px-4 py-3">{resolveName(entry.userId)}</td>
                    <td className="px-4 py-3">{entry.usedMinutes ?? "-"}</td>
                    <td className="px-4 py-3">{entry.addedMinutes ?? "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
