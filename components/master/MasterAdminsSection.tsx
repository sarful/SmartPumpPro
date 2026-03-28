import { DashboardEmptyState } from "@/components/DashboardEmptyState";

type AdminRow = {
  _id: string;
  username: string;
  status: string;
  loadShedding?: boolean;
  deviceReady?: boolean;
  deviceOnline?: boolean;
  devicePinHigh?: boolean;
  suspendReason?: string;
};

export function MasterAdminsSection({
  admins,
  copiedAdminId,
  internetOnline,
  onCopyAdminId,
  onSuspendAdmin,
  onUnsuspendAdmin,
  onDeleteAdmin,
}: {
  admins: AdminRow[];
  copiedAdminId: string | null;
  internetOnline: boolean;
  onCopyAdminId: (adminId: string) => void;
  onSuspendAdmin: (id: string) => void;
  onUnsuspendAdmin: (id: string) => void;
  onDeleteAdmin: (id: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Directory</div>
        <div className="text-lg font-semibold text-slate-950">All Admins</div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {admins.map((ad) => {
          const displayLoadShedding = Boolean(ad.loadShedding) || ad.deviceReady === false;
          const displayInternetOnline = internetOnline && ad.deviceReady !== false && ad.deviceOnline !== false;

          return (
            <article key={ad._id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-950">{ad.username}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold ${
                        ad.status === "suspended"
                          ? "bg-red-100 text-red-700"
                          : ad.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {ad.status}
                    </span>
                    {ad.suspendReason ? <span className="text-slate-500">{ad.suspendReason}</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ad.status === "suspended" ? (
                    <button
                      onClick={() => onUnsuspendAdmin(ad._id)}
                      className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      onClick={() => onSuspendAdmin(ad._id)}
                      className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteAdmin(ad._id)}
                    className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">Admin ID</span>
                <code className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">
                  {ad._id}
                </code>
                <button
                  onClick={() => onCopyAdminId(ad._id)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  {copiedAdminId === ad._id ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700">
                  Device:{" "}
                  <span className={`inline-flex items-center gap-1 font-semibold ${ad.deviceReady === false ? "text-red-700" : "text-emerald-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${ad.deviceReady === false ? "bg-red-500" : "bg-emerald-500"}`} />
                    {ad.deviceReady === false ? "Not Ready" : "Ready"}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700">
                  Loadshedding:{" "}
                  <span className={`inline-flex items-center gap-1 font-semibold ${displayLoadShedding ? "text-red-700" : "text-emerald-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${displayLoadShedding ? "bg-red-500" : "bg-emerald-500"}`} />
                    {displayLoadShedding ? "Yes" : "No"}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700">
                  Internet:{" "}
                  <span className={`inline-flex items-center gap-1 font-semibold ${displayInternetOnline ? "text-emerald-700" : "text-red-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${displayInternetOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                    {displayInternetOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {admins.length === 0 ? (
          <DashboardEmptyState
            title="No admins"
            message="Create or approve an admin to start onboarding tenant users."
          />
        ) : null}
      </div>
    </section>
  );
}
