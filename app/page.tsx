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

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Help Center
          </p>
          {/* <p className="mt-1 text-sm text-blue-900">New card for beginner support and technical docs.</p> */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Link
              href="/guide"
              className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Beginner Guide
            </Link>
            <Link
              href="/documentation"
              className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Documentation
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
