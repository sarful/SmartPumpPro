import Link from "next/link";

const sections = [
  {
    title: "Introduction to PumpPilot",
    description: "PumpPilot is a smart motor control platform for fair and safe pump usage.",
    points: [
      "One Admin controls one pump line with many users.",
      "System handles wallet minutes, queue, and load shedding automatically.",
      "ESP32 follows server command every few seconds.",
    ],
  },
  {
    title: "Account Login and Access",
    description: "Choose the correct role before login: Master Admin, Admin, or User.",
    points: [
      "User and Admin can register from Home page.",
      "New Admin may stay pending until Master Admin approval.",
      "If login fails, check role + username + password.",
    ],
    example: "Example: Admin 'Rahim' registers -> status pending -> Master approves -> then login works.",
  },
  {
    title: "Understanding the Dashboard",
    description: "Dashboard cards show real-time motor and wallet state.",
    points: [
      "Motor Status: OFF / RUNNING / HOLD",
      "Remaining Minutes: current running timer",
      "Available Minutes: wallet balance",
      "Queue cards appear only when user is queued",
    ],
  },
  {
    title: "Checking Your Balance",
    description: "Always verify balance before starting.",
    points: [
      "If balance is below 5 minutes, start controls are restricted.",
      "Recharge first, then run motor.",
    ],
    example: "Example: Balance 4m -> Start disabled -> request recharge -> after approval balance updates.",
  },
  {
    title: "Getting Minutes Recharge",
    description: "User requests minutes; Admin approves/recharges from Admin Dashboard.",
    points: [
      "User clicks Buy Minutes and sends request.",
      "Admin sees pending request and can Approve/Decline.",
      "Approved minutes are added instantly to user wallet.",
    ],
  },
  {
    title: "How to Start the Pump",
    description: "Set run time and start motor from User Dashboard.",
    points: [
      "Enter requested minutes in Set Minutes.",
      "Press Start Motor.",
      "If pump is busy, user automatically joins queue.",
    ],
    example: "Example: Request 10m while another user runs -> Queue Position becomes #1.",
  },
  {
    title: "How to Stop the Pump",
    description: "Stop can be pressed anytime, including queued state.",
    points: [
      "Running user: motor stops and usage is finalized.",
      "Queued user: queue entry is removed.",
      "Dashboard refreshes to normal OFF state.",
    ],
  },
  {
    title: "Unused Minute Return (Refund System)",
    description: "If a run is stopped early, unused requested minutes are returned to wallet balance.",
    points: [
      "System first reserves requested minutes for fair queue control.",
      "On early stop, actual used minutes are calculated from run time.",
      "Unused part is refunded automatically to Available Minutes.",
    ],
    example: "Example: User sets 10m, stops at 6m -> Used 6m, Refund 4m, wallet gets 4m back.",
  },
  {
    title: "Adding Extra Minutes",
    description: "When RUNNING, user can extend by +1 minute.",
    points: [
      "Button appears only during RUNNING.",
      "Each click increases remaining time by 1 minute.",
      "Wallet is adjusted accordingly.",
    ],
  },
  {
    title: "Understanding the Queue System",
    description: "Queue ensures only one active motor per admin.",
    points: [
      "Position #1 waits for current run to finish.",
      "Estimated wait depends on current and earlier queue times.",
      "Next user auto-starts when current run ends.",
    ],
    example: "Example: User A running 8m, User B queue #1 -> estimated wait about 8m.",
  },
  {
    title: "What to Do During Load Shedding",
    description: "Load shedding forces HOLD mode for safety.",
    points: [
      "Motor output turns OFF immediately.",
      "Timer pauses during HOLD.",
      "After power return, RUNNING resumes from same remaining time.",
    ],
  },
  {
    title: "Viewing Usage History",
    description: "Use Logs page to track activity.",
    points: [
      "See motor_start, motor_stop, recharge, hold, resume events.",
      "Master sees all logs, Admin sees own logs, User sees own logs.",
      "Useful for support and billing checks.",
    ],
  },
  {
    title: "Common Problems and Solutions",
    description: "Use this quick troubleshooting order.",
    points: [
      "Check internet and API base URL.",
      "Check account status (active/suspended).",
      "Check wallet balance and queue status.",
      "Check load shedding state and ESP32 connectivity.",
    ],
  },
  {
    title: "Safety Guidelines",
    description: "Follow electrical and operational safety at all times.",
    points: [
      "Do not bypass interlock or relay protection.",
      "Use proper rated contactor/relay and wiring.",
      "Keep panel dry and protected from dust/water.",
    ],
  },
  {
    title: "Best Usage Practices",
    description: "Good habits improve uptime and reduce disputes.",
    points: [
      "Set realistic run minutes, avoid oversized requests.",
      "Approve/decline requests quickly to keep workflow smooth.",
      "Review logs weekly for unusual behavior.",
      "Protect credentials, secrets, and device access.",
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          PumpPilot
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Beginner Guide</h1>
        <p className="mt-2 text-sm text-slate-600">
          This guide is written for absolute beginners. Follow each step in order.
        </p>

        <div className="mt-8 space-y-3">
          {sections.map((section, index) => (
            <article
              key={section.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <h2 className="text-sm font-semibold text-slate-900">
                {index + 1}. {section.title}
              </h2>
              <p className="mt-1 text-sm text-slate-700">{section.description}</p>
              {"points" in section && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {section.points.map((point: string) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              {"example" in section && section.example && (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  {section.example}
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/documentation"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open Documentation
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
