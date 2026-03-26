import Link from "next/link";

const sections = [
  {
    title: "Information We Collect",
    body: "PumpPilot may collect account information such as username, role, admin association, session data, and application activity required to operate the smart pump platform.",
  },
  {
    title: "How We Use Information",
    body: "We use collected information to authenticate users, manage motor access, maintain wallet minutes, process queue and request flows, sync device status, and provide admin or master controls.",
  },
  {
    title: "Device and Usage Data",
    body: "The platform may process device identifiers, session identifiers, API request metadata, logs, and operational events such as motor start, motor stop, recharge, hold, resume, and queue activity.",
  },
  {
    title: "ESP32 and Hardware Data",
    body: "When smart pump hardware is connected, PumpPilot may receive device readiness, load shedding, RFID UID matching results, and motor status updates to support safe automation.",
  },
  {
    title: "Mobile App Connectivity",
    body: "The mobile app connects to the PumpPilot backend to load dashboards, authenticate users, and perform role-based actions. Requests are sent over secure network connections when configured in production.",
  },
  {
    title: "Data Sharing",
    body: "We do not sell user data. Information is shared only as necessary to operate the service, such as secure backend processing, cloud hosting, database storage, and app distribution services.",
  },
  {
    title: "Data Retention",
    body: "Account, session, request, queue, and usage history data may be retained for operational, audit, troubleshooting, and support purposes for as long as reasonably needed by the service owner.",
  },
  {
    title: "Security",
    body: "PumpPilot uses authentication controls, protected backend endpoints, role-based access restrictions, and environment-based secrets to reduce unauthorized access. No system can be guaranteed to be 100 percent secure.",
  },
  {
    title: "User Choices",
    body: "Users may request account updates or removal through the service administrator or operator responsible for their PumpPilot deployment, subject to operational and audit requirements.",
  },
  {
    title: "Children",
    body: "PumpPilot is not designed for children. The app is intended for operational users, admins, and system operators in smart pump environments.",
  },
  {
    title: "Changes to This Policy",
    body: "This privacy policy may be updated when the application, infrastructure, or compliance needs change. Updated versions will be published on this page.",
  },
  {
    title: "Contact",
    body: "For privacy or account questions, contact the PumpPilot service owner, deployment administrator, or support team associated with your installation.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          PumpPilot
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page explains how PumpPilot may collect, use, and protect information
          across the web app, mobile app, backend API, and connected smart pump
          devices.
        </p>
        <p className="mt-2 text-xs text-slate-500">Effective date: March 26, 2026</p>

        <div className="mt-8 space-y-3">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to Home
          </Link>
          <Link
            href="/documentation"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open Documentation
          </Link>
        </div>
      </section>
    </main>
  );
}
