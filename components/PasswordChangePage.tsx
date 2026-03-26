"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Props = {
  expectedRole: "master" | "admin" | "user";
  loginHref: string;
  dashboardHref: string;
  title: string;
  subtitle: string;
};

export function PasswordChangePage({
  expectedRole,
  loginHref,
  dashboardHref,
  title,
  subtitle,
}: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(loginHref);
      return;
    }
    if (status === "authenticated" && session?.user?.role !== expectedRole) {
      router.replace(loginHref);
    }
  }, [expectedRole, loginHref, router, session?.user?.role, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error || data.message || "Password update failed");
      }

      setSuccess(data.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password update failed");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center shadow-2xl shadow-slate-950/40">
          Loading password settings...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">PumpPilot</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="current password"
          />
          <input
            type="password"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="new password"
          />
          <input
            type="password"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="confirm new password"
          />

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
            Password changes require your current password and must be completed while signed in.
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Change Password"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <Link href={dashboardHref} className="text-cyan-300 hover:text-cyan-200">
            Back to Dashboard
          </Link>
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
