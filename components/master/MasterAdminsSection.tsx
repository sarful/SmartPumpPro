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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-600">All Admins</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {admins.map((ad) => (
          <div key={ad._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
            <div className="font-semibold">{ad.username}</div>
            <div className="text-slate-600 text-xs">
              Status: {ad.status}
              {ad.suspendReason ? ` (${ad.suspendReason})` : ""}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Admin ID:</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {ad._id}
              </code>
              <button
                onClick={() => onCopyAdminId(ad._id)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100"
              >
                {copiedAdminId === ad._id ? "Copied" : "Copy"}
              </button>
            </div>
            {(() => {
              const displayLoadShedding = Boolean(ad.loadShedding) || ad.deviceReady === false;
              const displayInternetOnline =
                internetOnline && ad.deviceReady !== false && ad.deviceOnline !== false;
              return (
                <div className="mt-2 grid gap-1 text-xs">
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                    Device:{" "}
                    <span className={`inline-flex items-center gap-1 font-semibold ${ad.deviceReady === false ? "text-red-700" : "text-emerald-700"}`}>
                      <span className={`h-2 w-2 rounded-full ${ad.deviceReady === false ? "bg-red-500" : "bg-emerald-500"}`} />
                      {ad.deviceReady === false ? "Not Ready" : "Ready"}
                    </span>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                    Loadshedding:{" "}
                    <span className={`inline-flex items-center gap-1 font-semibold ${displayLoadShedding ? "text-red-700" : "text-emerald-700"}`}>
                      <span className={`h-2 w-2 rounded-full ${displayLoadShedding ? "bg-red-500" : "bg-emerald-500"}`} />
                      {displayLoadShedding ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700">
                    Internet:{" "}
                    <span className={`inline-flex items-center gap-1 font-semibold ${displayInternetOnline ? "text-emerald-700" : "text-red-700"}`}>
                      <span className={`h-2 w-2 rounded-full ${displayInternetOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                      {displayInternetOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div className="mt-2 flex flex-wrap gap-2">
              {ad.status === "suspended" ? (
                <button
                  onClick={() => onUnsuspendAdmin(ad._id)}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                >
                  Unsuspend
                </button>
              ) : (
                <button
                  onClick={() => onSuspendAdmin(ad._id)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
                >
                  Suspend
                </button>
              )}
              <button
                onClick={() => onDeleteAdmin(ad._id)}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
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
