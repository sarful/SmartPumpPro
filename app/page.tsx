import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <section className="mx-auto mt-2 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          PumpPilot
        </p>
        <h1 className="mt-3 text-center text-4xl font-semibold">Welcome</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Login or register to continue.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/master/login"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Master Admin Login
          </Link>
          <Link
            href="/admin/login"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Admin Login
          </Link>
          <Link
            href="/admin/register"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            Admin Register
          </Link>
          <Link
            href="/user/login"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
          >
            User Login
          </Link>
          <Link
            href="/user/register"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:col-span-2"
          >
            User Register
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/guide"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Beginner Guide
            </Link>
            <Link
              href="/documentation"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Documentation
            </Link>
            <Link
              href="/privacy-policy"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
