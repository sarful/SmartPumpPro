"use client";

type DashboardMessageProps = {
  title?: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

const variantClasses: Record<NonNullable<DashboardMessageProps["variant"]>, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

const buttonClasses: Record<NonNullable<DashboardMessageProps["variant"]>, string> = {
  info: "border-slate-300 text-slate-700 hover:bg-slate-100",
  success: "border-emerald-300 text-emerald-700 hover:bg-emerald-100",
  warning: "border-amber-300 text-amber-800 hover:bg-amber-100",
  error: "border-red-300 text-red-700 hover:bg-red-100",
};

export function DashboardMessage({
  title,
  message,
  variant = "info",
  actionLabel,
  onAction,
}: DashboardMessageProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${variantClasses[variant]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {title ? <div className="text-sm font-semibold">{title}</div> : null}
          <div className="text-sm">{message}</div>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${buttonClasses[variant]}`}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
