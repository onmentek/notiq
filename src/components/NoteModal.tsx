"use client";

import {
  Archive,
  ArrowUpToLine,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  Flame,
  ListChecks,
  Maximize2,
  Minimize2,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getColorMeta, NOTE_COLORS } from "@/lib/colors";
import {
  deriveDisplayTitle,
  formatRelativeTime,
  parseNoteLines,
  prependToContent,
  toggleChecklistLine,
} from "@/lib/frecency";
import { triggerHaptic } from "@/lib/storage";
import type { CardRect, Note, NoteColor } from "@/lib/types";

interface NoteModalProps {
  note: Note;
  originRect: CardRect | null;
  siblingNotes: Note[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (note: Note) => void;
  onSwitchNote: (note: Note, direction?: "next" | "prev") => void;
  switchDirection: "next" | "prev" | null;
}

export function NoteModal({
  note,
  originRect,
  siblingNotes,
  onClose,
  onUpdate,
  onDelete,
  onSwitchNote,
  switchDirection,
}: NoteModalProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [quickEntry, setQuickEntry] = useState("");
  const [asChecklist, setAsChecklist] = useState(false);
  const [withTimestamp, setWithTimestamp] = useState(false);
  const [interactiveView, setInteractiveView] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flashAdded, setFlashAdded] = useState(false);

  const quickInputRef = useRef<HTMLTextAreaElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const openedAtRef = useRef<number>(Date.now());
  const activeNoteIdRef = useRef<string>(note.id);

  // Sync local state when rapidly switching between cards
  useEffect(() => {
    activeNoteIdRef.current = note.id;
    openedAtRef.current = Date.now();
    setTitle(note.title);
    setContent(note.content);
    setQuickEntry("");
    setInteractiveView(false);
    requestAnimationFrame(() => {
      quickInputRef.current?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Shared-origin spring transform deltas from clicked card
  const originStyle = useMemo(() => {
    if (!originRect || typeof window === "undefined") return undefined;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const cardCenterX = originRect.left + originRect.width / 2;
    const cardCenterY = originRect.top + originRect.height / 2;
    const dx = Math.max(-220, Math.min(220, (cardCenterX - centerX) * 0.45));
    const dy = Math.max(-220, Math.min(220, (cardCenterY - centerY) * 0.45));
    return {
      "--origin-dx": `${Math.round(dx)}px`,
      "--origin-dy": `${Math.round(dy)}px`,
      "--origin-scale": "0.93",
    } as React.CSSProperties;
  }, [originRect]);

  const currentIdx = siblingNotes.findIndex((n) => n.id === note.id);
  const prevNote = currentIdx > 0 ? siblingNotes[currentIdx - 1] : null;
  const nextNote =
    currentIdx >= 0 && currentIdx < siblingNotes.length - 1
      ? siblingNotes[currentIdx + 1]
      : null;

  // Quick-switch dock shows up to 5 top neighboring/frequent cards
  const dockNotes = useMemo(() => {
    return siblingNotes.slice(0, 6);
  }, [siblingNotes]);

  const commitQuickEntry = (closeAfter = false) => {
    const trimmed = quickEntry.trim();
    if (!trimmed) {
      if (closeAfter) handleSafeClose();
      return;
    }
    const nextContent = prependToContent(content, trimmed, {
      asChecklist,
      withTimestamp,
    });
    setContent(nextContent);
    setQuickEntry("");
    setFlashAdded(true);
    triggerHaptic("light");
    onUpdate(note.id, { title, content: nextContent });
    setTimeout(() => setFlashAdded(false), 650);
    if (closeAfter) {
      onClose();
    } else {
      requestAnimationFrame(() => quickInputRef.current?.focus());
    }
  };

  const handleSafeClose = () => {
    const focusDelta = Math.min(300_000, Date.now() - openedAtRef.current);
    const trimmed = quickEntry.trim();
    if (trimmed) {
      const nextContent = prependToContent(content, trimmed, {
        asChecklist,
        withTimestamp,
      });
      onUpdate(note.id, {
        title,
        content: nextContent,
        totalFocusMs: note.totalFocusMs + focusDelta,
      });
    } else if (title !== note.title || content !== note.content || focusDelta > 2000) {
      onUpdate(note.id, {
        title,
        content,
        totalFocusMs: note.totalFocusMs + focusDelta,
      });
    }
    onClose();
  };

  const handleSwitch = (target: Note, dir: "next" | "prev") => {
    // Commit any pending top-input before switching cards!
    const trimmed = quickEntry.trim();
    if (trimmed) {
      const nextContent = prependToContent(content, trimmed, {
        asChecklist,
        withTimestamp,
      });
      onUpdate(note.id, { title, content: nextContent });
    } else if (title !== note.title || content !== note.content) {
      onUpdate(note.id, { title, content });
    }
    triggerHaptic("light");
    onSwitchNote(target, dir);
  };

  // Keyboard shortcuts while card is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSafeClose();
      } else if (e.altKey && e.key === "ArrowRight" && nextNote) {
        e.preventDefault();
        handleSwitch(nextNote, "next");
      } else if (e.altKey && e.key === "ArrowLeft" && prevNote) {
        e.preventDefault();
        handleSwitch(prevNote, "prev");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleCopy = async () => {
    const text = title.trim() ? `${title.trim()}\n\n${content}` : content;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      triggerHaptic("light");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const colorMeta = getColorMeta(note.color);
  const parsedLines = useMemo(() => parseNoteLines(content), [content]);
  const hasChecklist = parsedLines.some((l) => l.isChecklist);
  const wordCount = useMemo(() => {
    const words = `${title} ${content}`.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [title, content]);

  const animationClass =
    switchDirection === "next"
      ? "animate-switch-next"
      : switchDirection === "prev"
        ? "animate-switch-prev"
        : "animate-modal-in";

  return (
    <div
      className="glass-backdrop animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center p-2.5 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleSafeClose();
        }
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        touchStartX.current = null;
        touchStartY.current = null;

        // Horizontal swipe switches cards smoothly
        if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.6) {
          if (dx < 0 && nextNote) handleSwitch(nextNote, "next");
          if (dx > 0 && prevNote) handleSwitch(prevNote, "prev");
        }
      }}
    >
      {/* Desktop Edge Rapid-Switch Arrows */}
      {prevNote && (
        <button
          type="button"
          onClick={() => handleSwitch(prevNote, "prev")}
          title={`Önceki kart: ${deriveDisplayTitle(prevNote)} (Alt+←)`}
          className="glass-panel fixed left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:scale-105 hover:text-[var(--text-primary)] lg:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {nextNote && (
        <button
          type="button"
          onClick={() => handleSwitch(nextNote, "next")}
          title={`Sonraki kart: ${deriveDisplayTitle(nextNote)} (Alt+→)`}
          className="glass-panel fixed right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:scale-105 hover:text-[var(--text-primary)] lg:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Main Translucent Glass Card Sheet */}
      <div
        key={note.id}
        style={switchDirection ? undefined : originStyle}
        className={`glass-strong ${animationClass} relative flex w-full flex-col overflow-hidden rounded-3xl transition-[max-width,height] duration-200 ${
          isExpanded
            ? "h-[92vh] max-w-4xl"
            : "max-h-[82vh] max-w-2xl"
        }`}
      >
        {/* Ambient tint wash at top of glass modal */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${colorMeta.modalGlow}`}
        />

        {/* Top Modal Header Bar */}
        <div className="relative flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className={`h-2.5 w-2.5 rounded-full ${colorMeta.dot}`} />
            <span className="tabular-nums">
              {formatRelativeTime(note.updatedAt)}
            </span>
            {note.openCount > 1 && (
              <span className="hidden items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10.5px] font-medium text-amber-600 sm:inline-flex dark:text-amber-300">
                <Flame className="h-2.5 w-2.5" />
                {note.openCount}×
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {hasChecklist && (
              <button
                type="button"
                onClick={() => setInteractiveView((v) => !v)}
                title={interactiveView ? "Metin düzenlemeye geç" : "Etkileşimli liste görünümü"}
                className={`flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-medium transition ${
                  interactiveView
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/8"
                }`}
              >
                {interactiveView ? (
                  <>
                    <Edit3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Düzenle</span>
                  </>
                ) : (
                  <>
                    <ListChecks className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Liste</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
              title={note.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                note.isPinned
                  ? "bg-blue-500/15 text-blue-500"
                  : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/8"
              }`}
            >
              <Pin className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleCopy}
              title="Kopyala"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/8"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? "Normal boyut" : "Odak modu (Genişlet)"}
              className="hidden h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-black/5 hover:text-[var(--text-primary)] sm:flex dark:hover:bg-white/8"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleSafeClose}
              aria-label="Kapat"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 text-[var(--text-primary)] transition hover:bg-black/10 dark:bg-white/8 dark:hover:bg-white/14"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SIGNATURE FEATURE: TOP-FIRST INSTANT QUICK-APPEND COMPOSER */}
        <div
          className={`relative border-b border-[var(--border-subtle)] px-4 py-3 transition-colors sm:px-5 ${
            flashAdded
              ? "bg-emerald-500/12"
              : "bg-blue-500/[0.045] dark:bg-blue-400/[0.055]"
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-300">
              <ArrowUpToLine className="h-3.5 w-3.5" />
              <span>Üstten Hızlı Ekle</span>
              {flashAdded && (
                <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium normal-case text-emerald-600 dark:text-emerald-300">
                  En üste eklendi ✓
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAsChecklist((v) => !v)}
                title="Görev maddesi (- [ ]) olarak ekle"
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
                  asChecklist
                    ? "bg-emerald-500/18 text-emerald-600 dark:text-emerald-300"
                    : "text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/8"
                }`}
              >
                <CheckSquare className="h-3 w-3" />
                <span>Madde</span>
              </button>
              <button
                type="button"
                onClick={() => setWithTimestamp((v) => !v)}
                title="Saat damgası (HH:MM) ile ekle"
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
                  withTimestamp
                    ? "bg-amber-500/18 text-amber-600 dark:text-amber-300"
                    : "text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/8"
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Saat</span>
              </button>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <textarea
              ref={quickInputRef}
              rows={1}
              value={quickEntry}
              onChange={(e) => setQuickEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitQuickEntry(e.metaKey || e.ctrlKey);
                }
              }}
              placeholder={
                asChecklist
                  ? "Yeni görev maddesi yaz → Enter ile en üste ekle…"
                  : "Hızlıca yaz → Enter ile en üste ekle, ⌘Enter ile kaydet & kapat…"
              }
              aria-label="Notun üstüne hızlıca ekle"
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-blue-500/25 bg-white/75 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 dark:bg-black/25"
            />
            <button
              type="button"
              disabled={!quickEntry.trim()}
              onClick={() => commitQuickEntry(false)}
              className="flex h-[38px] shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
              <span>Ekle</span>
            </button>
          </div>
        </div>

        {/* Scrollable Editable Title + Note Body */}
        <div className="relative flex-1 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              onUpdate(note.id, { title: next, content });
            }}
            placeholder="Not başlığı…"
            className="w-full bg-transparent text-lg font-bold tracking-[-0.015em] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none sm:text-xl"
          />

          {interactiveView ? (
            <div className="mt-3 space-y-1.5">
              {parsedLines.map((line) =>
                line.isChecklist ? (
                  <button
                    key={line.index}
                    type="button"
                    onClick={() => {
                      const toggled = toggleChecklistLine(content, line.index);
                      setContent(toggled);
                      triggerHaptic("light");
                      onUpdate(note.id, { title, content: toggled });
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                        line.checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-[var(--border-strong)]"
                      }`}
                    >
                      {line.checked && <Check className="h-3 w-3 stroke-[3]" />}
                    </span>
                    <span
                      className={
                        line.checked
                          ? "text-[var(--text-muted)] line-through"
                          : "text-[var(--text-primary)]"
                      }
                    >
                      {line.text}
                    </span>
                  </button>
                ) : (
                  <p
                    key={line.index}
                    className="min-h-[1.25rem] px-2 text-sm leading-relaxed text-[var(--text-secondary)]"
                  >
                    {line.raw}
                  </p>
                )
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => {
                const next = e.target.value;
                setContent(next);
                onUpdate(note.id, { title, content: next });
              }}
              placeholder="Not içeriği… (#etiket veya - [ ] madde kullanabilirsin)"
              className={`mt-3 w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none ${
                isExpanded ? "min-h-[54vh]" : "min-h-[220px] sm:min-h-[260px]"
              }`}
            />
          )}
        </div>

        {/* Bottom Footer Toolbar inside Modal */}
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-2.5 sm:px-5">
          {/* Color Picker */}
          <div className="flex items-center gap-1.5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onUpdate(note.id, { color: c.id as NoteColor })}
                title={c.label}
                className={`h-4 w-4 rounded-full transition ${c.dot} ${
                  note.color === c.id
                    ? "scale-120 ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--bg-surface)]"
                    : "opacity-65 hover:opacity-100"
                }`}
              />
            ))}
          </div>

          {/* Meta & Danger Actions */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="hidden tabular-nums sm:inline">
              {wordCount} kelime
            </span>
            <button
              type="button"
              onClick={() => {
                onUpdate(note.id, { isArchived: !note.isArchived });
                onClose();
              }}
              title={note.isArchived ? "Arşivden çıkar" : "Arşivle"}
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-[var(--text-secondary)] transition hover:bg-black/6 hover:text-[var(--text-primary)] dark:hover:bg-white/8"
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {note.isArchived ? "Geri Al" : "Arşivle"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(note);
                onClose();
              }}
              title="Notu sil"
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-rose-500 transition hover:bg-rose-500/12"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sil</span>
            </button>
          </div>
        </div>
      </div>

      {/* RAPID CARD-TO-CARD TRANSLUCENT QUICK-SWITCH DOCK */}
      {dockNotes.length > 1 && (
        <div className="glass-panel no-scrollbar mt-3 flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl px-2 py-1.5 shadow-lg">
          {dockNotes.map((item, idx) => {
            const active = item.id === note.id;
            const itemColor = getColorMeta(item.color);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  !active &&
                  handleSwitch(item, idx > currentIdx ? "next" : "prev")
                }
                className={`flex max-w-[148px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-black/6 hover:text-[var(--text-primary)] dark:hover:bg-white/8"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${itemColor.dot}`} />
                <span className="truncate">{deriveDisplayTitle(item)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
