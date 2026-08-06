import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-deep">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 font-display text-3xl tracking-tight text-navy sm:text-4xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-base text-navy/65">{subtitle}</p> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line)] bg-white/80 p-5 shadow-[0_1px_0_rgba(7,24,33,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-deep",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function GhostLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-navy/15 bg-white/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:border-teal hover:bg-mist",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function WeightBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div>
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-navy/60">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-mist">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-deep to-teal"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-mist px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-deep">
      {children}
    </span>
  );
}
