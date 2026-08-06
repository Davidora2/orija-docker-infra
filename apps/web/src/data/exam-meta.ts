export type ExamSitting = {
  id: string;
  label: string;
  examDates: string;
  examStartIso: string;
  registrationOpens: string;
  registrationDeadline: string;
  supportingDocsDeadline: string;
  withdrawWithoutPenalty: string;
  feeCad: number;
  status: "open" | "upcoming" | "closed";
};

export type ExamMeta = {
  lastVerified: string;
  sourceUrl: string;
  passMark: number;
  formatSummary: string;
  eligibilityNote: string;
  delivery: string;
  sittings: ExamSitting[];
  officialLinks: { label: string; href: string; note?: string }[];
};

/** Curated from csct.ca Exam Candidate page + Exam Candidate Guide. */
export const examMeta: ExamMeta = {
  lastVerified: "2026-08-05",
  sourceUrl: "https://www.csct.ca/EXAM-CANDIDATE",
  passMark: 65,
  formatSummary:
    "Virtually proctored exam in two parts (2 hours each) with a 15-minute break. Question types: multiple choice, multiple select (choose all that apply), and case studies (10–15% of the exam).",
  eligibilityNote:
    "Only graduates of a CSCT-recognized educational program are eligible. CSCT no longer offers a pathway for foreign-trained candidates to challenge the exam.",
  delivery: "Meazure Learning (online proctored)",
  sittings: [
    {
      id: "may-2026",
      label: "May 2026",
      examDates: "May 4–5, 2026",
      examStartIso: "2026-05-04",
      registrationOpens: "February 4, 2026 (0900 PST)",
      registrationDeadline: "March 17, 2026 (1700 PST)",
      supportingDocsDeadline: "March 24, 2026 (1700 PST)",
      withdrawWithoutPenalty: "April 18, 2026 (1700 PST)",
      feeCad: 600,
      status: "closed",
    },
    {
      id: "oct-2026",
      label: "October 2026",
      examDates: "October 7–8, 2026",
      examStartIso: "2026-10-07",
      registrationOpens: "August 9, 2026 (0900 PST)",
      registrationDeadline: "August 22, 2026 (1700 PST)",
      supportingDocsDeadline: "August 29, 2026 (1700 PST)",
      withdrawWithoutPenalty: "TBD",
      feeCad: 600,
      status: "upcoming",
    },
  ],
  officialLinks: [
    {
      label: "Exam Candidate page",
      href: "https://www.csct.ca/EXAM-CANDIDATE",
      note: "Dates, fees, registration steps",
    },
    {
      label: "Exam Candidate Guide (PDF)",
      href: "https://www.csct.ca/resources/SCT%20Exam%20Candidate%20Guide%202024.pdf",
      note: "Format, regulations, rewrite policy",
    },
    {
      label: "Exam Blueprint (PDF)",
      href: "https://www.csct.ca/resources/Documents/CSCT%20National%20Certification%20Exam%20Blueprint.pdf",
      note: "NOCP area weighting",
    },
    {
      label: "NOCP",
      href: "https://www.csct.ca/NOCP",
      note: "National Occupational Competency Profile",
    },
    {
      label: "ECG Analysis Study Guide",
      href: "https://www.csct.ca/ECG-Analysis-Study-Guide",
      note: "Full identify checklist used in TraceReady Rhythms",
    },
    {
      label: "Exam Guidelines",
      href: "https://www.csct.ca/Guidelines-for-CSCT-Exam-Purposes",
      note: "Official measurement criteria for the exam",
    },
    {
      label: "Reading List",
      href: "https://www.csct.ca/reading-list",
      note: "Garcia, Huff, ACSM, AHA, Sweesy, and related refs",
    },
    {
      label: "Accredited Programs",
      href: "https://www.csct.ca/accredited-programs",
    },
    {
      label: "Rewrite Policy",
      href: "https://www.csct.ca/CSCT-Certification-Exam-Rewrite-Policy",
    },
    {
      label: "Ethical & Professional Standards",
      href: "https://www.csct.ca/ethical-and-professional-standards",
    },
  ],
};

export function getNextSitting(meta: ExamMeta = examMeta): ExamSitting | undefined {
  const upcoming = meta.sittings
    .filter((s) => s.status !== "closed")
    .sort((a, b) => a.examStartIso.localeCompare(b.examStartIso));
  return upcoming[0] ?? meta.sittings[meta.sittings.length - 1];
}
