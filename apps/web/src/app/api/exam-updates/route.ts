import { NextResponse } from "next/server";
import { examMeta, type ExamMeta, type ExamSitting } from "@/data/exam-meta";

function extractBlock(html: string, headingPattern: RegExp): string | null {
  const match = html.match(headingPattern);
  if (!match || match.index === undefined) return null;
  return html.slice(match.index, match.index + 2500);
}

function pick(text: string, label: RegExp): string | null {
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const m = cleaned.match(label);
  return m?.[1]?.trim() ?? null;
}

function parseSitting(
  html: string,
  id: string,
  label: string,
  examStartIso: string,
  status: ExamSitting["status"],
): ExamSitting | null {
  const examDates =
    pick(html, /Exam dates:\s*([^<\n]+)/i) ||
    pick(html, /Exam Dates\s*([^<\n]+)/i);
  const registrationOpens = pick(html, /Registration opens:\s*([^<\n]+)/i);
  const registrationDeadline = pick(html, /Registration deadline:\s*([^<\n]+)/i);
  const supportingDocsDeadline = pick(
    html,
    /Supporting document deadline:\s*([^<\n]+)/i,
  );
  const withdrawWithoutPenalty = pick(
    html,
    /Final withdrawal date without penalty:\s*([^<\n]+)/i,
  );
  const feeMatch = html.match(/Exam Fee:\s*\$?\s*([0-9]+)/i);

  if (!examDates && !registrationOpens && !registrationDeadline) return null;

  const fallback = examMeta.sittings.find((s) => s.id === id);

  return {
    id,
    label,
    examDates: examDates ?? fallback?.examDates ?? label,
    examStartIso: fallback?.examStartIso ?? examStartIso,
    registrationOpens: registrationOpens ?? fallback?.registrationOpens ?? "See csct.ca",
    registrationDeadline:
      registrationDeadline ?? fallback?.registrationDeadline ?? "See csct.ca",
    supportingDocsDeadline:
      supportingDocsDeadline ?? fallback?.supportingDocsDeadline ?? "See csct.ca",
    withdrawWithoutPenalty:
      withdrawWithoutPenalty ?? fallback?.withdrawWithoutPenalty ?? "TBD",
    feeCad: feeMatch ? Number(feeMatch[1]) : fallback?.feeCad ?? 600,
    status,
  };
}

export async function GET() {
  try {
    const res = await fetch("https://www.csct.ca/EXAM-CANDIDATE", {
      headers: {
        "User-Agent": "TraceReadyCSCTPrep/1.0 (study app; +https://github.com)",
        Accept: "text/html",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `CSCT returned HTTP ${res.status}. Showing curated data.`,
        meta: examMeta,
      });
    }

    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);

    // Prefer the October 2026 block if present; keep May as historical fallback.
    const octBlock =
      extractBlock(html, /October\s+7/i) ||
      extractBlock(html, /Registration opens:\s*August/i) ||
      html;
    const mayBlock = extractBlock(html, /May\s+4/i);

    const sittings: ExamSitting[] = [];
    const oct = parseSitting(octBlock, "oct-2026", "October 2026", "2026-10-07", "upcoming");
    if (oct) sittings.push(oct);
    if (mayBlock) {
      const may = parseSitting(mayBlock, "may-2026", "May 2026", "2026-05-04", "closed");
      if (may) sittings.push(may);
    }

    const merged: ExamMeta = {
      ...examMeta,
      lastVerified: today,
      sittings: sittings.length > 0 ? sittings : examMeta.sittings,
      eligibilityNote: /no longer offers a pathway for foreign-trained/i.test(html)
        ? "Only graduates of a CSCT-recognized educational program are eligible. CSCT no longer offers a pathway for foreign-trained candidates to challenge the exam."
        : examMeta.eligibilityNote,
    };

    const foundDates = Boolean(oct?.registrationOpens || oct?.examDates);

    return NextResponse.json({
      ok: true,
      meta: merged,
      note: foundDates
        ? "Refreshed fields from https://www.csct.ca/EXAM-CANDIDATE."
        : "Fetched CSCT page; kept curated dates where parsing was uncertain.",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Fetch failed",
      meta: examMeta,
    });
  }
}
