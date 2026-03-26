import Link from "next/link";

type Props = {
  title: string;
  subtitle: string;
  loginHref: string;
};

export function PasswordResetNotice({ title, subtitle, loginHref }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">PumpPilot</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Self-service password reset is disabled for security. Sign in and change your password from the dashboard.
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
          If you cannot sign in:
          <div className="mt-2 text-slate-400">
            Users should contact their admin. Admins should contact the master admin. Master admins should use the deployment owner support process.
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <Link href={loginHref} className="text-cyan-300 hover:text-cyan-200">
            Back to Login
          </Link>
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
