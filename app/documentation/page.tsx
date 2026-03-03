import Link from "next/link";

const hardwareRows = [
  ["ESP32", "GPIO5", "Optocoupler LED (+) via resistor", "Motor ON/OFF signal"],
  ["ESP32", "GND", "Optocoupler LED (-)", "Signal ground"],
  ["Optocoupler Output", "Collector", "Transistor Base (via 1k resistor)", "Isolation switching"],
  ["Optocoupler Output", "Emitter", "GND", "Ground reference"],
  ["Transistor", "Collector", "Relay Coil (-)", "Relay drive"],
  ["Transistor", "Emitter", "GND", "Ground"],
  ["Relay Coil (+)", "+12V", "External power", "Relay supply"],
  ["Relay COM", "AC Line", "Motor input", "Switching line"],
  ["Relay NO", "Motor Phase", "Motor power control", "-"],
  ["ESP32", "GPIO18 (example)", "Load Shedding input", "Grid status detect"],
];

const sections = [
  {
    title: "System Overview",
    body: "PumpPilot is a centralized motor control platform with web dashboard, mobile app, API backend, MongoDB storage, and ESP32 edge devices.",
    example: "Example: User starts motor from dashboard -> API updates state -> ESP32 polls and runs motor.",
  },
  {
    title: "High-Level Architecture",
    body: "One backend (Next.js App Router API) serves two clients (Web + React Native). MongoDB stores users, queue, wallet, logs, and system state.",
    example: "Flow: Web/Mobile -> /api/* -> Queue/Timer engines -> MongoDB -> ESP32 /api/esp32/poll",
  },
  {
    title: "Multi-Tenant Isolation Model",
    body: "Each Admin is a tenant. Users are strictly bound to adminId. Queue, minute requests, and runtime decisions are tenant-scoped.",
    example: "Admin Rahim users cannot affect Admin Q users or queue.",
  },
  {
    title: "Role-Based Access Control (RBAC)",
    body: "Master Admin: system-wide control. Admin: tenant control. User: motor operation only. Mobile and web both enforce role checks.",
    example: "User cannot call admin recharge API; request returns 403.",
  },
  {
    title: "Application Layer Design",
    body: "UI layer (pages/screens), API routes, engine layer (queue/timer/loadshedding), and model layer (mongoose schemas) are separated for maintainability.",
  },
  {
    title: "Wallet Engine Architecture",
    body: "Minutes are deducted on actual usage. Early stop returns unused minutes. Recharge updates availableMinutes with audit logs.",
    example: "Set 10m, stop at 6m -> used 6, refund 4.",
  },
  {
    title: "Smart Queue Engine Architecture",
    body: "Per admin only one RUNNING entry is allowed. New requests become WAITING with position. Next user auto-starts when current ends.",
    example: "User A RUNNING, User B starts -> WAITING #1.",
  },
  {
    title: "Load Shedding Engine Design",
    body: "Load shedding forces HOLD state, pauses decrement, and keeps remaining time intact for safe resume.",
    example: "RUNNING 8m -> HOLD due to power loss -> resume from 8m on recovery.",
  },
  {
    title: "Device Synchronization Engine",
    body: "ESP32 polling syncs physical state with backend state every 3-5 seconds. Local load-shedding pin can also be sent to server.",
  },
  {
    title: "ESP32 Firmware Architecture",
    body: "Firmware has WiFi/GPRS connect, poll loop, JSON parser, and motor GPIO decision logic using motorStatus + loadShedding.",
    example: "RUNNING + no LS => GPIO HIGH, otherwise GPIO LOW.",
  },
  {
    title: "Hardware Integration & Electrical Protection Design",
    body: "Use relay/contactor isolation, proper fuse/MCB, optocoupler path, and interlock rule (single active motor per admin) for safety.",
  },
  {
    title: "Database Schema & Index Strategy",
    body: "Core collections: admins, users, queues, usage_history, minute_requests, mobile_sessions. Indexed by adminId/userId/date/position for fast reads.",
    example: "Queue compound index adminId+position speeds waiting list reads.",
  },
  {
    title: "API Architecture & Endpoint Design",
    body: "REST endpoints are role-scoped: auth, motor, queue, admin actions, master actions, mobile endpoints, and ESP32 poll endpoint.",
    example: "POST /api/motor/start, POST /api/motor/stop, GET /api/esp32/poll?adminId=...",
  },
  {
    title: "Concurrency & State Management Strategy",
    body: "Queue ordering and state transitions are controlled server-side. Optimistic UI is corrected by realtime polling to prevent drift.",
  },
  {
    title: "Security Architecture",
    body: "Password hashing, JWT/session auth, role guards, suspend workflow, and protected mobile bearer token endpoints reduce abuse risk.",
  },
  {
    title: "Error Handling & Fail-Safe Strategy",
    body: "API routes use try/catch and explicit JSON errors. On failures, motor-safe fallback is OFF/HOLD depending on state.",
    example: "ESP32 non-200 response => keep safe OFF output.",
  },
  {
    title: "Scalability & Performance Strategy",
    body: "Tenant-scoped queries, indexed reads, lightweight polling payloads, and decoupled engines support scaling to 100+ motors.",
  },
  {
    title: "Deployment Architecture",
    body: "Web/API deploy on Vercel, MongoDB Atlas as database, ESP32 devices configured with hosted API URL, mobile app via Expo/EAS.",
  },
  {
    title: "Production Validation Checklist",
    body: "Validate env vars, auth roles, suspend behavior, queue correctness, hold/resume, refund correctness, and ESP32 command response.",
  },
  {
    title: "Future Upgrade & Expansion Roadmap",
    body: "Planned: websocket/MQTT realtime, richer analytics, alerting, backup/restore tooling, and stronger device certificate security.",
  },
];

export default function DocumentationPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          PumpPilot
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Documentation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quick technical documentation in simple language.
        </p>

        <div className="mt-8 space-y-3">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{section.body}</p>
              {section.title === "Hardware Integration & Electrical Protection Design" && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Component</th>
                        <th className="px-3 py-2 font-semibold">Pin/Terminal</th>
                        <th className="px-3 py-2 font-semibold">Connect To</th>
                        <th className="px-3 py-2 font-semibold">Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hardwareRows.map((row) => (
                        <tr key={`${row[0]}-${row[1]}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{row[0]}</td>
                          <td className="px-3 py-2">{row[1]}</td>
                          <td className="px-3 py-2">{row[2]}</td>
                          <td className="px-3 py-2">{row[3]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {"example" in section && section.example && (
                <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  {section.example}
                </p>
              )}
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/guide"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open Beginner Guide
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
