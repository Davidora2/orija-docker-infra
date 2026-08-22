import type { ReactNode } from "react";
import { HeroHills } from "./hero-hills";

type FocusHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  accentDot?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  hills?: boolean;
  className?: string;
  titleId?: string;
};

export function FocusHero({
  eyebrow,
  title,
  subtitle,
  meta,
  trailing,
  accentDot = true,
  actions,
  children,
  hills = false,
  className = "",
  titleId,
}: FocusHeroProps) {
  return (
    <article
      className={`relative overflow-hidden rounded-3xl border border-[#203b31] px-5 py-5 shadow-[0_18px_50px_rgba(20,36,31,0.14)] ${hills ? "min-h-[11.25rem]" : ""} ${className}`}
      style={{
        background:
          "radial-gradient(circle at 96% 8%, rgba(214, 245, 122, 0.18), transparent 35%), linear-gradient(145deg, #17332a, #10251f)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#d6f57a]/13"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-[4.5rem] h-48 w-48 rounded-full border border-[#d6f57a]/8"
      />

      {hills ? <HeroHills /> : null}

      <div className={`relative z-[1] ${hills ? "max-w-xl" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
            {accentDot ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6f57a]" />
            ) : null}
            <span className="truncate">{eyebrow}</span>
          </p>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>

        <h2
          id={titleId}
          className={`font-serif leading-tight tracking-tight text-white ${hills ? "mt-3 text-3xl sm:text-[2rem]" : "mt-5 text-3xl sm:text-4xl"}`}
        >
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-2 text-base font-medium text-white/72">{subtitle}</p>
        ) : null}

        {meta ? (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
            {meta}
          </p>
        ) : null}

        {children}
        {actions ? (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">{actions}</div>
        ) : null}
      </div>
    </article>
  );
}

export function FocusHeroHours({ children }: { children: ReactNode }) {
  return <span className="text-xs text-white/50">{children}</span>;
}
