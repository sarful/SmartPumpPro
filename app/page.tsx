import Link from "next/link";

const highlights = [
  { title: "100+ pumps", detail: "Centrally managed across admins" },
  { title: "Smart queue", detail: "Fair, single-motor enforcement" },
  { title: "Minutes wallet", detail: "Pay-as-you-run billing" },
  { title: "ESP32 ready", detail: "5s polling, safe GPIO control" },
];

const features = [
  {
    title: "Queue Engine",
    body: "One active motor per admin, auto-promotion when a slot frees up.",
  },
  {
    title: "Load Shedding",
    body: "Pause on power loss, resume with zero minute loss once power is back.",
  },
  {
    title: "Wallet & Refunds",
    body: "Charge only used minutes; early stops refund the remainder instantly.",
  },
  {
    title: "Real-Time Ops",
    body: "ESP32 polls every 5s for commands and status with lightweight JSON.",
  },
];

const steps = [
  "Master Admin approves admins, assigns pumps.",
  "Admins recharge users and monitor queues.",
  "Users start motors; queue engine enforces fairness.",
  "ESP32 obeys commands; timer engine bills actual minutes.",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default async function Home() {
  let overview: { admins: number; users: number } | null = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/overview`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (res.ok) {
      overview = await res.json();
    }
  } catch {
    overview = null;
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:py-20">
        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
              SmartPump Pro
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              IoT motor control built for fairness, safety, and scale.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Manage 100+ pumps with queues, wallet-based billing, load-shedding
              protection, and ESP32 edge control. Designed for multi-admin,
              multi-user operations with real-time feedback.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/app"
                className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:translate-y-[-1px] hover:bg-cyan-300"
              >
                Open Dashboard
              </Link>
              <Link
                href="https://nextjs.org/docs"
                className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-50 transition hover:border-cyan-400 hover:text-cyan-200"
              >
                Developer Docs
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <Link
                href="/admin/login"
                className="rounded-full border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200"
              >
                Admin Login
              </Link>
              <Link
                href="/admin/register"
                className="rounded-full border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200"
              >
                Admin Register
              </Link>
              <Link
                href="/user/login"
                className="rounded-full border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200"
              >
                User Login
              </Link>
              <Link
                href="/user/register"
                className="rounded-full border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200"
              >
                User Register
              </Link>
              <Link
                href="/master/admins"
                className="rounded-full border border-emerald-700 px-3 py-2 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
              >
                Master Approvals
              </Link>
              <span className="rounded-full border border-slate-800 px-3 py-2 text-slate-300">
                Active Admins: {overview?.admins ?? "--"}
              </span>
              <span className="rounded-full border border-slate-800 px-3 py-2 text-slate-300">
                Users: {overview?.users ?? "--"}
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
            <div className="mb-4 text-sm font-semibold text-cyan-200">
              Live Control Snapshot
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Admin</span>
                  <span className="text-cyan-300">Rahim</span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Queue
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">User A</span>
                    <span className="text-cyan-300">RUNNING · 8m left</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>User B</span>
                    <span>WAITING · pos 1</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>User C</span>
                    <span>WAITING · pos 2</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-slate-400">Status</div>
                  <div className="text-lg font-semibold text-emerald-300">
                    RUNNING
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-slate-400">Remaining</div>
                  <div className="text-lg font-semibold text-cyan-200">8m</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-slate-400">Load Shed</div>
                  <div className="text-lg font-semibold text-amber-300">
                    OFF
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-lg shadow-slate-950/40"
            >
              <div className="text-sm text-cyan-200">{item.title}</div>
              <div className="mt-2 text-sm text-slate-300">{item.detail}</div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="grid gap-6 lg:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl shadow-cyan-900/25"
            >
              <div className="text-base font-semibold text-slate-100">
                {feature.title}
              </div>
              <p className="mt-2 text-sm text-slate-300">{feature.body}</p>
            </div>
          ))}
        </section>

        {/* Steps */}
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl shadow-slate-950/40">
          <div className="text-sm uppercase tracking-[0.2em] text-cyan-300">
            How it runs
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-200">
            {steps.map((step, idx) => (
              <li
                key={step}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="mb-2 text-xs font-semibold text-cyan-200">
                  Step {idx + 1}
                </div>
                <p className="text-slate-300">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
