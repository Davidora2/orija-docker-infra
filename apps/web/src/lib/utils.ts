import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toJsonArray(values: string[]): string {
  return JSON.stringify(values);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function contentMatchScore(
  query: string,
  contentSummary: string | null | undefined,
  topics: string[],
  niches: string[],
): number {
  if (!query.trim()) return 0;
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = [
    contentSummary || "",
    topics.join(" "),
    niches.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 2;
  }
  for (const topic of topics) {
    if (q.includes(topic.toLowerCase()) || topic.toLowerCase().includes(q)) {
      score += 3;
    }
  }
  for (const niche of niches) {
    if (q.includes(niche.toLowerCase()) || niche.toLowerCase().includes(q)) {
      score += 2;
    }
  }
  return score;
}
