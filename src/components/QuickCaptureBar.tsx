"use client";

import { CheckSquare, Pin, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NOTE_COLORS } from "@/lib/colors";
import type { NoteColor } from "@/lib/types";

interface QuickCaptureBarProps {
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  onCreate: (draft: {
    title: string;
    content: string;
    color: NoteColor;
    isPinned: boolean;
  }) => void;
}

export function QuickCaptureBar({
  expanded,
  onExpandedChange,
  onCreate,
}: QuickCaptureBarProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [isPinned, setIsPinned] = useState(false);
  const [asChecklist, setAsChecklist] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => contentRef.current?.focus());
    }
  }, [expanded]);

  const reset = () => {
    setTitle("");
    setContent("");
    setColor("default");
    setIsPinned(false);
    setAsChecklist(false);
    onExpandedChange(false);
  };

  const commit = () => {
    const t = title.trim();
    const c = content.trim();
    if (!t && !c) {
      reset();
      return;
    }

    let formattedContent = content;
    if (asChecklist && c) {
      formattedContent = content
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "";
          if (/^[-*]?\s*\[[ xX]\]/.test(trimmed)) return trimmed;
          return `- [ ] ${trimmed}`;
        })
        .join("\n");
    }

    onCreate({
      title: t,
      content: formattedContent,
      color,
      isPinned,
    });
    reset();
  };

  useEffect(() => {
    if (!expanded) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commit();
      }
    };
    window.addEventListener("mousedown", onOutside);
    return () => window.removeEventListener("mousedown", onOutside);
  });

  if (!expanded) {
    return (
      <div className="mx-auto max-w-6xl px-3 pb-3 sm:px-5">
        <div className="glass-panel flex items-center gap-2 rounded-2xl p-1.5 pl-3.5 transition hover:border-[var(--border-strong)]">
          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            className="flex flex-1 items-center gap-2.5 py-1.5 text-left text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            <Plus className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span>Hızlı not yaz…</span>
            <span className="ml-auto hidden rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] sm:inline">
              N
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAsChecklist(true);
              onExpandedChange(true);
            }}
            title="Hızlı görev listesi oluştur"
            className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/8"
          >
            <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Liste</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 pb-4 sm:px-5" ref={containerRef}>
      <div className="glass-strong animate-peek-pop overflow-hidden rounded-2xl p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                contentRef.current?.focus();
              } else if (e.key === "Escape") {
                reset();
              }
            }}
            placeholder="Başlık (isteğe bağlı)…"
            className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <button
            type="button"
            onClick={() => setIsPinned((v) => !v)}
            title="Sabitle"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
              isPinned
                ? "bg-blue-500/15 text-blue-500"
                : "text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/8"
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Kapat"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/8"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          ref={contentRef}
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              reset();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={
            asChecklist
              ? "Her satıra bir görev yaz… (#etiket ekleyebilirsin)"
              : "Aklındakini hemen yaz… (#etiket veya - [ ] madde kullanabilirsin)"
          }
          className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
          <div className="flex items-center gap-2">
            {/* Color dots */}
            <div className="flex items-center gap-1.5">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.label}
                  className={`h-4 w-4 rounded-full transition ${c.dot} ${
                    color === c.id
                      ? "scale-115 ring-2 ring-blue-500 ring-offset-2 ring-offset-[var(--bg-surface)]"
                      : "opacity-65 hover:opacity-100"
                  }`}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-[var(--border-subtle)]" />

            <button
              type="button"
              onClick={() => setAsChecklist((v) => !v)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                asChecklist
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/8"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Görev</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">
              ⌘Enter ile kaydet
            </span>
            <button
              type="button"
              onClick={commit}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-500 active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
