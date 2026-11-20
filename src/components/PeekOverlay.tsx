"use client";

import { ArrowUpRight, Check, Flame, Pin, X } from "lucide-react";
import { useEffect } from "react";
import { getColorMeta } from "@/lib/colors";
import {
  deriveDisplayTitle,
  formatRelativeTime,
  isFrequentNote,
  parseNoteLines,
} from "@/lib/frecency";
import type { Note } from "@/lib/types";

interface PeekOverlayProps {
  note: Note;
  onClose: () => void;
  onOpenFull: (note: Note) => void;
  onToggleChecklist: (note: Note, lineIndex: number) => void;
}

/**
 * Yarı Saydam Hızlı Bakış (Translucent Quick-Peek):
 * Press Space on any card or tap the eye icon for an instant frosted-glass glance
 * that closes immediately on Esc, Space, or backdrop click.
 */
export function PeekOverlay({
  note,
  onClose,
  onOpenFull,
  onToggleChecklist,
}: PeekOverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onClose();
        onOpenFull(note);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [note, onClose, onOpenFull]);

  const colorMeta = getColorMeta(note.color);
  const lines = parseNoteLines(note.content);
  const frequent = isFrequentNote(note);

  return (
    <div
      className="glass-backdrop animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong animate-peek-pop relative w-full max-w-lg overflow-hidden rounded-3xl p-5">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${colorMeta.modalGlow}`}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-[var(--text-muted)]">
              <span className="rounded-full bg-blue-500/12 px-2 py-0.5 text-blue-600 dark:text-blue-300">
                Hızlı Bakış
              </span>
              <span>{formatRelativeTime(note.updatedAt)}</span>
              {frequent && (
                <span className="inline-flex items-center gap-0.5 text-amber-500">
                  <Flame className="h-3 w-3" /> Sık
                </span>
              )}
              {note.isPinned && <Pin className="h-3 w-3 text-blue-500" />}
            </div>
            <h3 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              {deriveDisplayTitle(note)}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Hızlı bakışı kapat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/8 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 text-sm leading-relaxed text-[var(--text-secondary)]">
          {lines.length === 0 ? (
            <p className="italic text-[var(--text-muted)]">İçerik boş.</p>
          ) : (
            lines.map((line) =>
              line.isChecklist ? (
                <button
                  key={line.index}
                  type="button"
                  onClick={() => onToggleChecklist(note, line.index)}
                  className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/6"
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                      line.checked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border-strong)]"
                    }`}
                  >
                    {line.checked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                  <span
                    className={
                      line.checked ? "text-[var(--text-muted)] line-through" : ""
                    }
                  >
                    {line.text}
                  </span>
                </button>
              ) : (
                <p key={line.index} className="min-h-[1rem] break-words">
                  {line.raw}
                </p>
              )
            )
          )}
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[11px] text-[var(--text-muted)]">
            Space / Esc kapat · Enter üstten yaz
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFull(note);
            }}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            <span>Üstten Yaz / Aç</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
