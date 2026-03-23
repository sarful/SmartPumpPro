export function MasterApprovalControl({
  manualAdminApproval,
  savingApprovalMode,
  onToggle,
}: {
  manualAdminApproval: boolean;
  savingApprovalMode: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-600">Admin Approval Control</div>
          <div className="text-xs text-slate-500">
            ON = new admins stay pending and need master approval. OFF = auto approve new admins.
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={savingApprovalMode}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
            manualAdminApproval ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {savingApprovalMode
            ? "Saving..."
            : manualAdminApproval
              ? "ON (Manual approval)"
              : "OFF (Auto approval)"}
        </button>
      </div>
    </section>
  );
}
