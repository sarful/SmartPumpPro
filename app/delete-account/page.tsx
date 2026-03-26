import Link from "next/link";

const steps = [
  "Open the PumpPilot mobile app or web app and sign in with your account if possible.",
  "Contact your administrator, service owner, or support contact responsible for your PumpPilot deployment.",
  "Provide your username, role, and the deployment or admin name linked to your account.",
  "Clearly state that you want your PumpPilot account and associated personal data deleted.",
  "The operator may verify account ownership before processing the deletion request.",
];

const details = [
  {
    title: "What can be deleted",
    body: "Account records, login access, mobile sessions, and user-linked operational data may be deleted or anonymized based on the deployment owner's process and legal or audit obligations.",
  },
  {
    title: "What may be retained",
    body: "Certain usage history, audit logs, or safety records may be retained for operational, fraud-prevention, billing, troubleshooting, or compliance reasons where required.",
  },
  {
    title: "How to request deletion",
    body: "PumpPilot does not currently provide a self-service in-app delete button. Deletion requests must be submitted to the service operator, deployment administrator, or support contact managing your PumpPilot instance.",
  },
  {
    title: "Response process",
    body: "After identity verification, the service owner should review the request and process it within a reasonable period according to their internal policy and local requirements.",
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          PumpPilot
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Delete Account Request</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page explains how a user can request deletion of a PumpPilot account
          and associated personal data.
        </p>
        <p className="mt-2 text-xs text-slate-500">Effective date: March 26, 2026</p>

        <article className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h2 className="text-base font-semibold">How to request account deletion</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <div className="mt-4 space-y-3">
          {details.map((detail) => (
            <article
              key={detail.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <h2 className="text-base font-semibold">{detail.title}</h2>
              <p className="mt-1 text-sm text-slate-700">{detail.body}</p>
            </article>
          ))}
        </div>

        <article className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <h2 className="text-base font-semibold text-amber-900">Contact guidance</h2>
          <p className="mt-1 text-sm text-amber-900">
            If you do not know who manages your PumpPilot deployment, contact the
            organization, operator, or administrator that issued your account.
          </p>
        </article>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy-policy"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Open Privacy Policy
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
