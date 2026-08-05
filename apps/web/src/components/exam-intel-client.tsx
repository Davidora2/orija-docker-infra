"use client";

import { useState } from "react";
import type { ExamMeta } from "@/data/exam-meta";
import { Panel, Tag } from "@/components/ui";

export function ExamIntelRefresh({ initial }: { initial: ExamMeta }) {
  const [meta, setMeta] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/exam-updates", { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        meta?: ExamMeta;
        note?: string;
        error?: string;
      };
      if (data.ok && data.meta) {
        setMeta(data.meta);
        setMessage(data.note ?? "Updated from CSCT sources.");
      } else {
        setMessage(data.error ?? "Could not refresh. Showing curated data.");
      }
    } catch {
      setMessage("Network error. Showing curated local data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Checking CSCT…" : "Refresh latest exam info"}
        </button>
        <p className="text-xs text-navy/55">
          Last verified locally: {meta.lastVerified}
        </p>
      </div>
      {message ? (
        <p className="text-sm text-teal-deep">{message}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {meta.sittings.map((sitting) => (
          <Panel key={sitting.id}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-2xl text-navy">{sitting.label}</h3>
              <Tag>{sitting.status}</Tag>
            </div>
            <p className="mt-2 text-lg font-semibold text-coral">{sitting.examDates}</p>
            <dl className="mt-4 space-y-2 text-sm text-navy/75">
              <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                <dt>Registration opens</dt>
                <dd className="text-right font-medium text-navy">{sitting.registrationOpens}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                <dt>Registration deadline</dt>
                <dd className="text-right font-medium text-navy">
                  {sitting.registrationDeadline}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                <dt>Supporting docs</dt>
                <dd className="text-right font-medium text-navy">
                  {sitting.supportingDocsDeadline}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
                <dt>Withdraw w/o penalty</dt>
                <dd className="text-right font-medium text-navy">
                  {sitting.withdrawWithoutPenalty}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt>Fee</dt>
                <dd className="font-medium text-navy">${sitting.feeCad} CAD</dd>
              </div>
            </dl>
          </Panel>
        ))}
      </div>

      <Panel>
        <h3 className="font-display text-xl text-navy">Format & eligibility</h3>
        <p className="mt-3 text-sm leading-relaxed text-navy/75">{meta.formatSummary}</p>
        <p className="mt-3 text-sm leading-relaxed text-navy/75">{meta.eligibilityNote}</p>
        <p className="mt-3 text-sm text-navy/60">
          Pass mark: <span className="font-semibold text-navy">{meta.passMark}%</span> · Delivery:{" "}
          {meta.delivery}
        </p>
        <a
          href={meta.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-semibold text-teal-deep hover:underline"
        >
          View on csct.ca ↗
        </a>
      </Panel>
    </div>
  );
}
