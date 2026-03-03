import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          SmartPump Pro
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Welcome</h1>
        <p className="mt-2 text-sm text-slate-600">
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
      </section>
    </main>
  );
}
