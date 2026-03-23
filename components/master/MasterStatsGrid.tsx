function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-4xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function MasterStatsGrid({
  overview,
}: {
  overview: { adminCount: number; userCount: number; running: number; waiting: number };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Admins" value={overview.adminCount} />
      <StatCard title="Users" value={overview.userCount} />
      <StatCard title="Running" value={overview.running} />
      <StatCard title="Waiting" value={overview.waiting} />
    </div>
  );
}
