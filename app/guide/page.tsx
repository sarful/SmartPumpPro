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
      "OFF means the motor is stopped.",
      "RUNNING means the motor is active.",
      "HOLD means the session is paused for safety and may resume automatically.",
      "Remaining Minutes: current running timer",
      "Available Minutes: wallet balance",
      "Queue cards appear only when user is queued",
    ],
  },
  {
    title: "Check Balance Before Start",
    description: "Always check your available balance before trying to run the motor.",
    points: [
      "A minimum usable balance is required before start is allowed.",
      "If the balance is too low, the system blocks the start request.",
      "Recharge or request minutes first, then try again.",
      "Available Minutes shows your current wallet balance.",
    ],
    example: "Example: If your balance is too low, the Start action will not continue until more minutes are added.",
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
    description: "Choose your run time and start the motor from the User Dashboard.",
    points: [
      "Enter the number of minutes you want to use.",
      "Press Start Motor to send the request.",
      "If the pump is already busy, you are placed in queue automatically.",
      "If the start is accepted, the dashboard changes to RUNNING.",
    ],
    example: "Example: If another user is already running the pump, your queue position is shown instead of immediate start.",
  },
  {
    title: "How to Stop the Pump",
    description: "You can stop an active run or cancel your queued request from the dashboard.",
    points: [
      "If you are RUNNING, the motor stops and the session is finalized.",
      "If you are waiting in queue, your pending request is removed.",
      "After stop, the dashboard returns to the normal OFF view.",
    ],
  },
  {
    title: "How Balance Updates After a Run",
    description: "When a run ends, PumpPilot updates the final balance automatically.",
    points: [
      "The system tracks active usage during the session.",
      "When the run ends early or reaches its stop condition, the final balance is recalculated automatically.",
      "The final safety balance is protected during stop conditions.",
    ],
    example: "Example: A user starts a run, uses the pump for some time, and then stops. The wallet is updated automatically based on actual usage and current safety rules.",
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
    description: "The queue allows only one active motor session per admin line.",
    points: [
      "Position #1 waits for the current run to finish.",
      "Estimated wait depends on the current run and earlier queued users.",
      "The next user starts automatically when the current run ends.",
    ],
    example: "Example: If one user is already running, the next user sees queue position and waits for automatic start.",
  },
  {
    title: "RFID Card Mode",
    description: "RFID mode lets an assigned card start a session for its linked user.",
    points: [
      "An assigned RFID card starts the motor for its linked account.",
      "While card mode is active, the dashboard shows that a card session is in use.",
      "When the session ends or reaches its stop condition, the motor stops automatically.",
      "Card mode follows the same safety rules as normal sessions.",
    ],
  },
  {
    title: "HOLD and Recovery",
    description: "For safety, the system can pause a session without losing the active run.",
    points: [
      "If load shedding starts, the motor goes to HOLD.",
      "If the device becomes not ready, the session can also move to HOLD.",
      "HOLD is a protection state, not a normal stop.",
      "When normal conditions return, the session can continue from the remaining time.",
    ],
    example: "Example: A running session moves to HOLD because the device is not ready. When the device becomes ready again, the motor can resume from the remaining time.",
  },
  {
    title: "Viewing Usage History",
    description: "Use Logs page to track activity.",
    points: [
      "See motor_start, motor_stop, recharge, hold, resume, and queue events.",
      "Master sees all logs, Admin sees own logs, User sees own logs.",
      "Logs are useful for support, review, and billing checks.",
    ],
  },
  {
    title: "Common Problems and Solutions",
    description: "If something does not work, check these items in order.",
    points: [
      "Check internet or device connectivity first.",
      "Check whether the device is ready.",
      "Check load shedding status.",
      "Check wallet balance and queue position.",
      "Check account status if start is still blocked.",
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
