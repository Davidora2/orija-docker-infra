"use client";

import {
  type AreasPlanSummary,
  type IdeasPlanSummary,
  type ProjectsPlanSummary,
} from "@life-os/plan-domain";
import { CapacityRing } from "./capacity-ring";

type PlanSummaryStripProps =
  | {
      segment: "areas";
      summary: AreasPlanSummary;
    }
  | {
      segment: "projects";
      summary: ProjectsPlanSummary;
    }
  | {
      segment: "ideas";
      summary: IdeasPlanSummary;
    };

export function PlanSummaryStrip(props: PlanSummaryStripProps) {
  const { summary } = props;
  const showRing =
    props.segment !== "ideas" &&
    "availableHours" in summary &&
    summary.availableHours > 0 &&
    summary.plannedHours >= 0;

  return (
    <div
      className="flex max-h-[120px] min-h-[72px] items-center gap-3 rounded-2xl border border-[#2a3d36] bg-[#14241f] px-4 py-3 text-[#f4f5f0]"
      aria-label={`${summary.line}. ${summary.stateLabel}`}
    >
      {showRing ? (
        <CapacityRing
          available={summary.availableHours}
          planned={summary.plannedHours}
          size={56}
          label="Weekly capacity"
          colors={{
            track: "rgba(255,255,255,0.16)",
            used: "#d6f57a",
            over: "#f2a08f",
            text: "#f4f5f0",
          }}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-snug text-[#f4f5f0]">
          {summary.line}
        </p>
        <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-[0.12em] text-[#a8b5a3]">
          {summary.stateLabel}
        </p>
      </div>
    </div>
  );
}
