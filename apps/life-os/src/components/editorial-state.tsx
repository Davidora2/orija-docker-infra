"use client";

import { useEffect, useState, type ReactNode } from "react";

type EditorialStateProps = {
  kind: "empty" | "loading" | "error";
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EditorialState({
  kind,
  title,
  description,
  action,
  compact = false,
}: EditorialStateProps) {
  return (
    <section
      className={`rounded-2xl border px-5 text-center ${
        compact ? "py-5" : "py-8"
      } ${
        kind === "error"
          ? "border-[#e7b7ad] bg-[#fdf4f1]"
          : "border-[#dde2dd] bg-white"
      }`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-busy={kind === "loading" || undefined}
    >
      <div
        className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
          kind === "error"
            ? "bg-[#f8e4df] text-[#c9634f]"
            : "bg-[#eef3ea] text-[#617a57]"
        }`}
        aria-hidden="true"
      >
        {kind === "loading" ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
        ) : kind === "error" ? (
          "!"
        ) : (
          "·"
        )}
      </div>
      <h3 className="font-serif text-xl text-[#14241f]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#6c7771]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function DelayedEditorialLoading({
  title,
  description,
  delayMs = 180,
}: {
  title: string;
  description: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return <div className="min-h-24" aria-hidden="true" />;
  return <EditorialState kind="loading" title={title} description={description} />;
}
