"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminOption = { _id: string; username: string };

export default function UserRegisterPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [adminId, setAdminId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingAdmins, setFetchingAdmins] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdmins = async () => {
      setFetchingAdmins(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/list-active");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load admins");
        }
        setAdmins(data.admins || []);
        if ((data.admins || []).length > 0) {
          setAdminId(data.admins[0]._id);
        }
      } catch (err: any) {
        setError(err instanceof Error ? err.message : "Failed to load admins");
      } finally {
        setFetchingAdmins(false);
      }
    };
    fetchAdmins();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!adminId) {
      setError("Please select an admin");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, adminId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      setSuccess("User created successfully.");
      setUsername("");
      setPassword("");
      router.push("/user/login");
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
            PumpPilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold">User Registration</h1>
          <p className="text-sm text-slate-400">Join an active admin and start pumping.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Admin</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              disabled={fetchingAdmins || admins.length === 0}
            >
              {admins.map((admin) => (
                <option key={admin._id} value={admin._id}>
                  {admin.username}
                </option>
              ))}
            </select>
            {fetchingAdmins && <p className="mt-2 text-xs text-slate-400">Loading admins...</p>}
            {!fetchingAdmins && admins.length === 0 && (
              <p className="mt-2 text-xs text-red-300">No active admins available.</p>
            )}
          </div>

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
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-100">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || fetchingAdmins || admins.length === 0}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Are you an admin?{" "}
          <Link href="/admin/register" className="text-cyan-300 hover:text-cyan-200">
            Go to Admin Registration
          </Link>
        </div>
        <div className="mt-3 text-center text-xs">
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
