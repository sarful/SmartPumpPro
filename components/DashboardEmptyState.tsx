type DashboardEmptyStateProps = {
  title: string;
  message: string;
};

export function DashboardEmptyState({ title, message }: DashboardEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="mt-1">{message}</div>
    </div>
  );
}
