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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Approval Flow</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Admin Approval Control</div>
          <div className="mt-1 max-w-2xl text-sm text-slate-600">
            ON keeps new admins pending for manual approval. OFF allows approved admins to become active automatically.
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={savingApprovalMode}
          className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${
            manualAdminApproval ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {savingApprovalMode
            ? "Saving..."
            : manualAdminApproval
              ? "ON · Manual Approval"
              : "OFF · Auto Approval"}
        </button>
      </div>
    </section>
  );
}
