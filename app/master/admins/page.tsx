"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type PendingAdmin = { _id: string; username: string; status: string };

export default function MasterAdminsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [admins, setAdmins] = useState<PendingAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isMaster = session?.user?.role === "master";

  useEffect(() => {
    if (status === "authenticated" && isMaster) {
      router.replace("/master/dashboard");
      return;
    }

    if (status === "loading") return;
    if (!isMaster) return;
    const loadPending = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/pending");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load pending admins");
        setAdmins(data.admins || []);
      } catch (err: any) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    loadPending();
  }, [isMaster, router, status]);

  const handleApprove = async (adminId: string) => {
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      setActionMessage(`Approved ${data.admin.username}`);
      setAdmins((prev) => prev.filter((a) => a._id !== adminId));
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (status === "loading") {
    return <div className="p-6 text-slate-200">Loading session...</div>;
  }

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-lg font-semibold">Master admin access required.</p>
          <button
            onClick={() => router.push("/master/login")}
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Master Console</p>
          <h1 className="mt-2 text-2xl font-semibold">Pending Admin Approvals</h1>
          <p className="text-sm text-slate-400">Review and approve admins.</p>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="mt-3 rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {actionMessage && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
            {actionMessage}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-300">Loading pending admins...</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-300">No pending admins.</p>
        ) : (
          <ul className="space-y-3">
            {admins.map((admin) => (
              <li
                key={admin._id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">{admin.username}</p>
                  <p className="text-xs text-slate-400">Status: {admin.status}</p>
                </div>
                <button
                  onClick={() => handleApprove(admin._id)}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 shadow-md shadow-emerald-900/40 hover:bg-emerald-400"
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
