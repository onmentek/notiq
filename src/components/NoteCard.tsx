"use client";

import {
  Archive,
  Check,
  Eye,
  Flame,
  Pin,
  Trash2,
} from "lucide-react";
import { useRef } from "react";
import { getColorMeta } from "@/lib/colors";
import {
  deriveDisplayTitle,
  formatRelativeTime,
  isFrequentNote,
  parseNoteLines,
} from "@/lib/frecency";
import type { CardRect, Note, ViewMode } from "@/lib/types";
import { HighlightText } from "./HighlightText";

interface NoteCardProps {
  note: Note;
  viewMode: ViewMode;
  isSelected?: boolean;
  highlightTerms?: string[];
  onOpen: (note: Note, rect: CardRect) => void;
  onPeek: (note: Note) => void;
  onHoverChange?: (noteId: string | null) => void;
  onTogglePin: (note: Note) => void;
  onToggleArchive: (note: Note) => void;
  onDelete: (note: Note) => void;
  onToggleChecklist: (note: Note, lineIndex: number) => void;
  onSelectTag: (tag: string) => void;
}

export function NoteCard({
  note,
  viewMode,
  isSelected = false,
  highlightTerms = [],
  onOpen,
  onPeek,
  onHoverChange,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onToggleChecklist,
  onSelectTag,
}: NoteCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const colorMeta = getColorMeta(note.color);
  const displayTitle = deriveDisplayTitle(note);
  const frequent = isFrequentNote(note);

  const lines = parseNoteLines(note.content).filter((l) => l.raw.trim().length > 0);
  // Avoid duplicating the first line if it was automatically used as title
  const previewLines =
    !note.title.trim() && lines.length > 0 && lines[0].text.trim() === displayTitle.trim()
      ? lines.slice(1)
      : lines;

  const maxLines = viewMode === "compact" ? 3 : viewMode === "list" ? 2 : 6;
  const visibleLines = previewLines.slice(0, maxLines);
  const hiddenCount = Math.max(0, previewLines.length - visibleLines.length);

  const checklistTotal = lines.filter((l) => l.isChecklist).length;
  const checklistDone = lines.filter((l) => l.isChecklist && l.checked).length;

  const handleOpen = () => {
    const rect = cardRef.current?.getBoundingClientRect();
    onOpen(
      note,
      rect
        ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        : { top: 120, left: 120, width: 320, height: 220 }
    );
  };

  return (
    <article
      ref={cardRef}
      tabIndex={0}
      role="button"
      aria-label={`Notu aç: ${displayTitle}`}
      onMouseEnter={() => onHoverChange?.(note.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleOpen();
        } else if (e.key === " ") {
          e.preventDefault();
          onPeek(note);
        }
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-3.5 text-left outline-none note-card-shadow ${
        colorMeta.cardClass
      } ${
        isSelected
          ? "ring-2 ring-blue-500/70 ring-offset-2 ring-offset-[var(--bg-canvas)]"
          : "focus-visible:ring-2 focus-visible:ring-blue-500/60"
      } ${viewMode === "list" ? "sm:flex-row sm:items-center sm:gap-4 sm:py-3" : ""}`}
    >
      {/* Subtle top color bar for colored cards */}
      {note.color !== "default" && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-[2.5px] opacity-85 ${colorMeta.accentBar}`}
        />
      )}

      {/* Header Row */}
      <div
        className={`flex items-start justify-between gap-2 ${
          viewMode === "list" ? "sm:w-56 sm:shrink-0" : ""
        }`}
      >
        <h3 className="line-clamp-2 text-[14.5px] leading-snug font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          <HighlightText text={displayTitle} terms={highlightTerms} />
        </h3>

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {frequent && (
            <span
              title={`Sık kullanılan (${note.openCount} açılma, ${note.editCount} düzenleme)`}
              className="flex items-center gap-0.5 rounded-full bg-amber-500/14 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300"
            >
              <Flame className="h-2.5 w-2.5" />
            </span>
          )}
          {note.isPinned && (
            <span
              title="Sabitlendi"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/12 text-blue-500 dark:text-blue-400"
            >
              <Pin className="h-3 w-3 fill-current" />
            </span>
          )}
        </div>
      </div>

      {/* Body Preview with Direct Interactive Checklists */}
      {visibleLines.length > 0 && (
        <div
          className={`mt-2 space-y-1 text-[13px] leading-relaxed text-[var(--text-secondary)] ${
            viewMode === "list" ? "sm:mt-0 sm:min-w-0 sm:flex-1" : ""
          }`}
        >
          {visibleLines.map((line) =>
            line.isChecklist ? (
              <div
                key={line.index}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChecklist(note, line.index);
                }}
                className="flex items-start gap-2 rounded-md py-0.5 transition hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                    line.checked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[var(--border-strong)] bg-transparent hover:border-blue-500"
                  }`}
                >
                  {line.checked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                </span>
                <span
                  className={`line-clamp-1 flex-1 ${
                    line.checked ? "text-[var(--text-muted)] line-through" : ""
                  }`}
                >
                  <HighlightText text={line.text} terms={highlightTerms} />
                </span>
              </div>
            ) : (
              <p key={line.index} className="line-clamp-2 break-words">
                <HighlightText text={line.text} terms={highlightTerms} />
              </p>
            )
          )}

          {hiddenCount > 0 && (
            <div className="text-[11px] font-medium text-[var(--text-muted)]">
              +{hiddenCount} satır daha
            </div>
          )}
        </div>
      )}

      {/* Footer: Tags, Checklist Progress, Timestamp & Floating Hover Actions */}
      <div
        className={`mt-3 flex items-center justify-between gap-2 pt-1 ${
          viewMode === "list" ? "sm:mt-0 sm:shrink-0" : ""
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {checklistTotal > 0 && (
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-300">
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {note.tags.slice(0, viewMode === "compact" ? 2 : 3).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTag(tag);
              }}
              className="max-w-[96px] truncate rounded-md bg-black/[0.045] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-muted)] transition hover:bg-blue-500/15 hover:text-blue-600 dark:bg-white/[0.06] dark:hover:text-blue-300"
            >
              #{tag}
            </button>
          ))}
        </div>

        <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>

      {/* Hover / Focus Translucent Micro-Action Pill */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel pointer-events-none absolute right-2 bottom-2 flex items-center gap-0.5 rounded-xl p-1 opacity-0 shadow-md transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
      >
        <button
          type="button"
          onClick={() => onPeek(note)}
          title="Hızlı Bakış (Space)"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-black/8 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onTogglePin(note)}
          title={note.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
          className={`flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-black/8 dark:hover:bg-white/10 ${
            note.isPinned ? "text-blue-500" : "text-[var(--text-secondary)]"
          }`}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(note)}
          title={note.isArchived ? "Arşivden çıkar" : "Arşivle"}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-black/8 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(note)}
          title="Sil"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-rose-500/15 hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
