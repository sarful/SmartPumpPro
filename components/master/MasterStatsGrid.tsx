function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-100 from-blue-50 to-cyan-50"
      : tone === "emerald"
        ? "border-emerald-100 from-emerald-50 to-teal-50"
        : tone === "amber"
          ? "border-amber-100 from-amber-50 to-orange-50"
          : "border-violet-100 from-violet-50 to-indigo-50";

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">{value}</div>
    </div>
  );
}

export function MasterStatsGrid({
  overview,
}: {
  overview: { adminCount: number; userCount: number; running: number; waiting: number };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Admins" value={overview.adminCount} tone="blue" />
      <StatCard title="Users" value={overview.userCount} tone="emerald" />
      <StatCard title="Running" value={overview.running} tone="amber" />
      <StatCard title="Waiting" value={overview.waiting} tone="violet" />
    </div>
  );
}
