export const MEMBERSHIP_STATUSES = [
  "INVITED",
  "PREVIEWED",
  "APPLIED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "ACTIVE",
  "DELIVERABLES_SUBMITTED",
  "VERIFIED",
  "PAID",
  "COMPLETED",
  "WITHDRAWN",
  "CANCELED",
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const COMP_MODELS = ["PAID", "GIFTING", "AFFILIATE", "HYBRID"] as const;
export const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "X", "BLOG"] as const;

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELED: "bg-rose-100 text-rose-800",
  INVITED: "bg-slate-100 text-slate-700",
  PREVIEWED: "bg-indigo-100 text-indigo-800",
  APPLIED: "bg-violet-100 text-violet-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  DELIVERABLES_SUBMITTED: "bg-sky-100 text-sky-800",
  VERIFIED: "bg-teal-100 text-teal-800",
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-violet-100 text-violet-800",
  NEEDS_REVISION: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  LIVE: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-amber-100 text-amber-800",
  FAILED: "bg-rose-100 text-rose-800",
};
