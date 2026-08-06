import { NextRequest, NextResponse } from "next/server";
import { examMeta, type ExamMeta, type ExamSitting } from "@/data/exam-meta";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 8;

type CacheEntry = {
  at: number;
  payload: {
    ok: boolean;
    meta: ExamMeta;
    note?: string;
    error?: string;
  };
};

const cache: { entry: CacheEntry | null } = { entry: null };
const hits = new Map<string, number[]>();

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

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

async function fetchExamMeta(): Promise<CacheEntry["payload"]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://www.csct.ca/EXAM-CANDIDATE", {
      headers: {
        "User-Agent": "TraceReadyCSCTPrep/1.0 (study app; +https://github.com)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `CSCT returned HTTP ${res.status}. Showing curated data.`,
        meta: examMeta,
      };
    }

    // Cap HTML size to avoid memory abuse from unexpectedly large responses.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const maxBytes = 1_500_000;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            reader.cancel().catch(() => undefined);
            break;
          }
          chunks.push(value);
        }
      }
    }

    const html = new TextDecoder("utf-8").decode(
      chunks.length
        ? (() => {
            const out = new Uint8Array(total > maxBytes ? maxBytes : total);
            let offset = 0;
            for (const chunk of chunks) {
              const slice = chunk.subarray(0, Math.max(0, out.length - offset));
              out.set(slice, offset);
              offset += slice.length;
              if (offset >= out.length) break;
            }
            return out;
          })()
        : await res.arrayBuffer().then((b) => new Uint8Array(b).slice(0, maxBytes)),
    );

    const today = new Date().toISOString().slice(0, 10);
    const octBlock =
      extractBlock(html, /October\s+7/i) ||
      extractBlock(html, /Registration opens:\s*August/i) ||
      html.slice(0, 8000);
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

    return {
      ok: true,
      meta: merged,
      note: foundDates
        ? "Refreshed fields from https://www.csct.ca/EXAM-CANDIDATE."
        : "Fetched CSCT page; kept curated dates where parsing was uncertain.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const key = clientKey(req);
  if (!allowRequest(key)) {
    const stale = cache.entry?.payload ?? {
      ok: false,
      error: "Rate limited. Showing curated data.",
      meta: examMeta,
    };
    return NextResponse.json(
      {
        ...stale,
        ok: stale.ok,
        error: "Too many refresh requests. Try again in a minute.",
        note: stale.note ?? "Served cached/curated exam intel due to rate limiting.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
      },
    );
  }

  const now = Date.now();
  if (cache.entry && now - cache.entry.at < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cache.entry.payload,
      note: `${cache.entry.payload.note ?? "Cached exam intel."} (cached)`,
    });
  }

  try {
    const payload = await fetchExamMeta();
    cache.entry = { at: now, payload };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    const payload = {
      ok: false as const,
      error: error instanceof Error ? error.message : "Fetch failed",
      meta: examMeta,
    };
    return NextResponse.json(payload);
  }
}
