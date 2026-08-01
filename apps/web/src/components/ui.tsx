import { STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";

export function Badge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] || "bg-slate-100 text-slate-700",
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-violet-600 text-white hover:bg-violet-500 shadow-sm",
    secondary:
      "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string },
) {
  const { label, className, id, ...rest } = props;
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      <input
        id={id}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 placeholder:text-slate-400 focus:ring-2",
          className,
        )}
        {...rest}
      />
    </label>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string },
) {
  const { label, className, id, ...rest } = props;
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      <textarea
        id={id}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 placeholder:text-slate-400 focus:ring-2",
          className,
        )}
        {...rest}
      />
    </label>
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string },
) {
  const { label, className, id, children, ...rest } = props;
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      <select
        id={id}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500/30 focus:ring-2",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
