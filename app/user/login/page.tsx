"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function UserLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      window.location.href = "/user/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
            PumpPilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold">User Login</h1>
          <p className="text-sm text-slate-400">Sign in to control your pump.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Username</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-900/40 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Need an account?{" "}
          <Link href="/user/register" className="text-cyan-300 hover:text-cyan-200">
            Register
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <Link href="/user/forgot-password" className="text-cyan-300 hover:text-cyan-200">
            Forgot password?
          </Link>
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
