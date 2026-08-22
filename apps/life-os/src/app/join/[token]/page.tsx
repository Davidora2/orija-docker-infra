"use client";

import { use, useState } from "react";
import { LifeIcon } from "../../../components/life-icon";

export default function JoinHouseholdPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [copied, setCopied] = useState(false);
  const deepLink = `lifeos://join?token=${encodeURIComponent(token)}`;

  async function copyCode() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen bg-[#e5eae4] px-5 py-10 text-[#14241f]">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[24px] border border-[#d4dad4] bg-white shadow-[0_24px_70px_rgba(16,37,31,.14)]">
        <div className="bg-[#10251f] px-7 py-8 text-white">
          <div className="mb-7 flex items-center gap-3">
            <span className="relative block h-9 w-9 rounded-full border border-[#eaf7bd]">
              <span className="absolute inset-[9px] rounded-full bg-[#d6f57a]" />
            </span>
            <span className="text-sm font-semibold">Life OS</span>
          </div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-white/50">
            <LifeIcon name="link" size={14} color="currentColor" /> Partner invitation
          </p>
          <h1 className="font-serif text-3xl tracking-[-.03em]">
            You’ve been invited to a shared household.
          </h1>
          <p className="mt-3 text-xs leading-5 text-white/55">
            Keep your own account while choosing which goals, projects and actions
            you share together.
          </p>
        </div>

        <div className="space-y-5 p-7">
          <div className="flex gap-3 rounded-xl bg-[#f0f5ed] p-4 text-[#526a47]">
            <LifeIcon
              className="mt-0.5 shrink-0"
              name="shield"
              size={20}
              color="currentColor"
            />
            <p className="text-[11px] leading-5">
              Private items remain private. Joining only gives access to records
              explicitly marked as shared.
            </p>
          </div>

          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14241f] text-xs font-bold text-[#f4f5f0]"
            href={deepLink}
          >
            Open in Life OS <LifeIcon name="external" size={16} color="currentColor" />
          </a>

          <div className="relative py-1 text-center text-[9px] font-bold uppercase tracking-widest text-[#8a948e]">
            <span className="relative z-10 bg-white px-3">or paste this code</span>
            <span className="absolute left-0 right-0 top-1/2 h-px bg-[#e2e6e1]" />
          </div>

          <button
            className="flex w-full items-center justify-between rounded-xl border border-[#d9dfd9] bg-[#fafbf9] p-4 text-left"
            onClick={copyCode}
          >
            <span className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7b867f]">
                Secure invite code
              </span>
              <code className="mt-2 block truncate text-[11px] text-[#14241f]">
                {token}
              </code>
            </span>
            {copied ? (
              <LifeIcon className="shrink-0" name="check" size={16} />
            ) : (
              <LifeIcon className="shrink-0" name="copy" size={16} />
            )}
          </button>

          <p className="text-center text-[10px] leading-4 text-[#7b867f]">
            Sign in or create your personal profile first, then open Profile &
            Household and choose “Join household.”
          </p>
        </div>
      </section>
    </main>
  );
}
