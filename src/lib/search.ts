import { computeFrecencyScore, hasUncheckedTodo } from "./frecency";
import type { Note, NoteColor, SearchMatch } from "./types";

const TR_CHAR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/**
 * Fast Turkish-aware text normalizer so "alisveris" matches "Alışveriş"
 * and "istanbul" matches "İstanbul".
 */
export function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çğıiöşüâîû]/g, (ch) => TR_CHAR_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface ParsedQuery {
  terms: string[];
  tags: string[];
  isPinned: boolean | null;
  isTodo: boolean | null;
  isArchived: boolean | null;
  color: NoteColor | null;
}

const VALID_COLORS = new Set<NoteColor>([
  "default",
  "amber",
  "sage",
  "sky",
  "lavender",
  "rose",
]);

export function parseSearchQuery(rawQuery: string): ParsedQuery {
  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  const tags: string[] = [];
  let isPinned: boolean | null = null;
  let isTodo: boolean | null = null;
  let isArchived: boolean | null = null;
  let color: NoteColor | null = null;

  for (const token of tokens) {
    const lower = token.toLocaleLowerCase("tr");
    if (lower.startsWith("#") && lower.length > 1) {
      tags.push(normalizeText(lower.slice(1)));
    } else if (lower === "is:pinned" || lower === "is:sabit") {
      isPinned = true;
    } else if (lower === "is:todo" || lower === "is:gorev") {
      isTodo = true;
    } else if (lower === "is:archived" || lower === "is:arsiv") {
      isArchived = true;
    } else if (lower.startsWith("color:") || lower.startsWith("renk:")) {
      const value = lower.split(":")[1] as NoteColor;
      if (VALID_COLORS.has(value)) color = value;
    } else {
      terms.push(normalizeText(token));
    }
  }

  return { terms, tags, isPinned, isTodo, isArchived, color };
}

/**
 * Lightweight subsequence fuzzy matcher for typos or abbreviations (e.g. "alvr" -> "alisveris").
 */
function fuzzySubsequenceScore(needle: string, haystack: string): number {
  if (needle.length < 2 || needle.length > haystack.length) return 0;
  let ni = 0;
  let consecutive = 0;
  let bonus = 0;

  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      ni++;
      consecutive++;
      bonus += consecutive > 1 ? 2 : 1;
    } else {
      consecutive = 0;
    }
  }
  if (ni !== needle.length) return 0;
  return (bonus / needle.length) * 4;
}

function extractBestSnippet(content: string, terms: string[]): string {
  const clean = content.replace(/\r/g, "").trim();
  if (!clean) return "";
  if (terms.length === 0) {
    return clean.slice(0, 160);
  }

  const normalized = normalizeText(clean);
  let bestIdx = -1;
  for (const term of terms) {
    const idx = normalized.indexOf(term);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }

  if (bestIdx === -1) return clean.slice(0, 160);
  const start = Math.max(0, bestIdx - 42);
  const end = Math.min(clean.length, bestIdx + 128);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

/**
 * Instant multi-signal search over notes (< 1ms for thousands of cards).
 */
export function searchNotes(
  notes: Note[],
  rawQuery: string,
  now = Date.now()
): SearchMatch[] {
  const parsed = parseSearchQuery(rawQuery);
  const results: SearchMatch[] = [];

  for (const note of notes) {
    if (note.deletedAt) continue;

    if (parsed.isArchived !== null) {
      if (note.isArchived !== parsed.isArchived) continue;
    } else if (note.isArchived) {
      continue;
    }

    if (parsed.isPinned && !note.isPinned) continue;
    if (parsed.isTodo && !hasUncheckedTodo(note.content)) continue;
    if (parsed.color && note.color !== parsed.color) continue;

    if (parsed.tags.length > 0) {
      const normalizedTags = note.tags.map(normalizeText);
      const hasAllTags = parsed.tags.every((qt) =>
        normalizedTags.some((nt) => nt.includes(qt))
      );
      if (!hasAllTags) continue;
    }

    const normTitle = normalizeText(note.title);
    const normContent = normalizeText(note.content);
    const normTags = note.tags.map(normalizeText).join(" ");

    let relevance = 0;
    let allMatched = true;

    for (const term of parsed.terms) {
      let termScore = 0;

      if (normTitle.startsWith(term)) {
        termScore += 45;
      } else if (normTitle.includes(term)) {
        termScore += 30;
      }

      if (normTags.includes(term)) {
        termScore += 24;
      }

      const bodyIdx = normContent.indexOf(term);
      if (bodyIdx !== -1) {
        // Earlier matches in note (top-inserted entries!) get slightly higher rank
        const positionBoost = Math.max(0, 8 - bodyIdx / 80);
        termScore += 14 + positionBoost;
      }

      if (termScore === 0) {
        const fuzzyTitle = fuzzySubsequenceScore(term, normTitle);
        if (fuzzyTitle >= 5) {
          termScore += fuzzyTitle;
        }
      }

      if (termScore === 0) {
        allMatched = false;
        break;
      }
      relevance += termScore;
    }

    if (!allMatched) continue;

    // Frecency acts as an intelligent relevance multiplier & tie-breaker
    const frecency = computeFrecencyScore(note, now);
    const pinBoost = note.isPinned ? 6 : 0;
    const totalScore = relevance + Math.min(frecency * 0.9, 18) + pinBoost;

    results.push({
      note,
      score: totalScore,
      snippet: extractBestSnippet(note.content, parsed.terms),
      matchedTerms: parsed.terms,
    });
  }

  results.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return b.note.updatedAt - a.note.updatedAt;
  });

  return results;
}

/**
 * Splits a string into plain and highlighted segments matching normalized search terms.
 */
export function getHighlightSegments(
  text: string,
  terms: string[]
): Array<{ text: string; highlight: boolean }> {
  if (!text || terms.length === 0) {
    return [{ text, highlight: false }];
  }

  const normText = normalizeText(text);
  const ranges: Array<[number, number]> = [];

  for (const rawTerm of terms) {
    const term = normalizeText(rawTerm);
    if (!term) continue;
    let startIndex = 0;
    while (startIndex < normText.length) {
      const idx = normText.indexOf(term, startIndex);
      if (idx === -1) break;
      ranges.push([idx, idx + term.length]);
      startIndex = idx + term.length;
    }
  }

  if (ranges.length === 0) {
    return [{ text, highlight: false }];
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  const segments: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlight: false });
    }
    segments.push({ text: text.slice(start, end), highlight: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: false });
  }
  return segments;
}
