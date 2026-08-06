"use client";

import { useEffect, useState } from "react";
import { rhythmsByCategory, type RhythmTopic } from "@/data/rhythms";
import { loadProgress, markRhythmStudied } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { Panel, Tag } from "@/components/ui";

export function RhythmChecklist() {
  const grouped = rhythmsByCategory();
  const [studied, setStudied] = useState<string[]>([]);
  const [active, setActive] = useState<RhythmTopic | null>(null);

  useEffect(() => {
    setStudied(loadProgress().rhythmsStudied);
  }, []);

  function open(rhythm: RhythmTopic) {
    setActive(rhythm);
    const next = markRhythmStudied(rhythm.id);
    setStudied(next.rhythmsStudied);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="font-display text-xl text-navy">{category}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {items.map((item) => {
                const seen = studied.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => open(item)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition",
                      seen
                        ? "border-teal bg-mist text-teal-deep"
                        : "border-[var(--line)] bg-white text-navy hover:border-teal",
                      active?.id === item.id && "ring-2 ring-coral/40",
                    )}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        {active ? (
          <Panel>
            <Tag>{active.category}</Tag>
            <h3 className="mt-3 font-display text-2xl text-navy">{active.name}</h3>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/50">
                Hallmarks
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy/75">
                {active.hallmarks.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/50">
                Watch for
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy/75">
                {active.watchFor.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </Panel>
        ) : (
          <Panel className="ecg-grid">
            <p className="font-display text-2xl text-navy">Open a rhythm</p>
            <p className="mt-2 text-sm text-navy/65">
              Work through the CSCT ECG Analysis Study Guide list. Checked items are saved on this
              device.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
