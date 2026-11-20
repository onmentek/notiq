import type { Note, ParsedLine, SortMode } from "./types";

const HALF_LIFE_HOURS = 72; // 3-day decay half-life for natural frecency adaptation
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_HOURS;
const HOUR_MS = 3_600_000;

/**
 * Computes a dynamic Frecency score (Frequency × Exponential Time Decay).
 * Frequently opened/edited notes naturally rise to the top and gradually cool down
 * when unused, keeping active notes within immediate reach.
 */
export function computeFrecencyScore(note: Note, now = Date.now()): number {
  const lastActivity = Math.max(
    note.lastOpenedAt || 0,
    note.updatedAt || 0,
    note.createdAt || 0
  );
  const ageHours = Math.max(0, (now - lastActivity) / HOUR_MS);
  const decay = Math.exp(-DECAY_LAMBDA * ageHours);

  const openWeight = (note.openCount || 0) * 1.4;
  const editWeight = (note.editCount || 0) * 2.8;
  const focusWeight = Math.min((note.totalFocusMs || 0) / 15_000, 12);

  // Base momentum ensures brand-new notes don't sink immediately
  const rawActivity = 1.5 + openWeight + editWeight + focusWeight;
  // Blend decayed frecency with a small long-term frequency floor so power-notes stay accessible
  const score = rawActivity * (0.82 * decay + 0.18);
  return Math.round(score * 1000) / 1000;
}

/**
 * Determines whether a note qualifies as a "Sık Kullanılan" (Frequently Used) card.
 */
export function isFrequentNote(note: Note, now = Date.now()): boolean {
  if (note.isArchived || note.deletedAt) return false;
  const openCount = note.openCount || 0;
  const editCount = note.editCount || 0;
  if (openCount < 2 && editCount < 3) return false;
  const touches = openCount + editCount * 1.4;
  return touches >= 5.5 || computeFrecencyScore(note, now) >= 9.0;
}

/**
 * Sorts notes according to the selected mode.
 * Pinned notes always remain prioritized at the top within active views.
 */
export function sortNotes(
  notes: Note[],
  mode: SortMode,
  now = Date.now()
): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    switch (mode) {
      case "smart": {
        const diff = computeFrecencyScore(b, now) - computeFrecencyScore(a, now);
        if (Math.abs(diff) > 0.01) return diff;
        return b.updatedAt - a.updatedAt;
      }
      case "frequent": {
        const aFreq = a.openCount * 1.2 + a.editCount * 2.2;
        const bFreq = b.openCount * 1.2 + b.editCount * 2.2;
        if (bFreq !== aFreq) return bFreq - aFreq;
        return b.lastOpenedAt - a.lastOpenedAt;
      }
      case "created":
        return b.createdAt - a.createdAt;
      case "updated":
      default:
        return b.updatedAt - a.updatedAt;
    }
  });
}

/**
 * Extracts unique #tags (Turkish-letter aware) from title and content.
 */
const TAG_REGEX = /(?:^|[\s(])#([\p{L}\p{N}_-]{2,28})/gu;

export function extractTags(title: string, content: string): string[] {
  const combined = `${title}\n${content}`;
  const set = new Set<string>();
  let match: RegExpExecArray | null;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(combined)) !== null) {
    const normalized = match[1].toLocaleLowerCase("tr");
    set.add(normalized);
  }
  return Array.from(set).slice(0, 12);
}

/**
 * Derives a crisp display title when a note has no explicit title.
 */
export function deriveDisplayTitle(note: Pick<Note, "title" | "content">): string {
  const trimmedTitle = note.title.trim();
  if (trimmedTitle) return trimmedTitle;

  const firstLine = note.content
    .split("\n")
    .map((line) =>
      line
        .replace(/^[-*]\s*\[[ xX]\]\s*/, "")
        .replace(/^#+\s*/, "")
        .trim()
    )
    .find(Boolean);

  if (!firstLine) return "Başlıksız Not";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}…` : firstLine;
}

/**
 * Parses lines of a note into structured checklist / plain text lines.
 */
const CHECKLIST_RE = /^(\s*(?:[-*]\s*)?)\[([ xX])\]\s?(.*)$/;

export function parseNoteLines(content: string): ParsedLine[] {
  if (!content) return [];
  return content.split("\n").map((raw, index) => {
    const m = raw.match(CHECKLIST_RE);
    if (m) {
      return {
        index,
        raw,
        isChecklist: true,
        checked: m[2].toLowerCase() === "x",
        text: m[3],
      };
    }
    return {
      index,
      raw,
      isChecklist: false,
      checked: false,
      text: raw,
    };
  });
}

/**
 * Toggles a specific checklist line in note content without disturbing other lines.
 */
export function toggleChecklistLine(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;
  const line = lines[lineIndex];
  const m = line.match(CHECKLIST_RE);
  if (!m) return content;
  const prefix = m[1] || "- ";
  const nextMark = m[2].toLowerCase() === "x" ? " " : "x";
  lines[lineIndex] = `${prefix}[${nextMark}] ${m[3]}`;
  return lines.join("\n");
}

/**
 * Checks whether a note contains at least one unchecked checklist item.
 */
export function hasUncheckedTodo(content: string): boolean {
  return /(?:^|\n)\s*(?:[-*]\s*)?\[ \]\s?/m.test(content);
}

/**
 * Formats and prepends a quick-entry string cleanly to the top of a note.
 */
export function prependToContent(
  existingContent: string,
  entry: string,
  options?: { asChecklist?: boolean; withTimestamp?: boolean }
): string {
  const cleanEntry = entry.trim();
  if (!cleanEntry) return existingContent;

  const lines = cleanEntry.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    let formatted = trimmed;
    if (options?.withTimestamp && !options?.asChecklist) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      formatted = `${hh}:${mm} — ${formatted}`;
    }
    if (options?.asChecklist && !CHECKLIST_RE.test(trimmed)) {
      formatted = `- [ ] ${formatted}`;
    }
    return formatted;
  });

  const block = lines.join("\n").trim();
  const existing = existingContent.trimStart();
  if (!existing) return block;
  return `${block}\n${existing}`;
}

/**
 * Relative Turkish time formatter (concise & clean).
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 45) return "az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}
