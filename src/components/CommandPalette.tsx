"use client";

import {
  ArrowRight,
  Download,
  Eye,
  Flame,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getColorMeta } from "@/lib/colors";
import { deriveDisplayTitle, isFrequentNote } from "@/lib/frecency";
import { searchNotes } from "@/lib/search";
import type { Note } from "@/lib/types";
import { HighlightText } from "./HighlightText";

interface CommandPaletteProps {
  notes: Note[];
  theme: "dark" | "light";
  onClose: () => void;
  onSelectNote: (note: Note) => void;
  onPeekNote: (note: Note) => void;
  onCreateNote: (title: string) => void;
  onToggleTheme: () => void;
  onSyncNow: () => void;
  onExportJson: () => void;
}

export function CommandPalette({
  notes,
  theme,
  onClose,
  onSelectNote,
  onPeekNote,
  onCreateNote,
  onToggleTheme,
  onSyncNow,
  onExportJson,
}: CommandPaletteProps) {
  const [input, setInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    return searchNotes(notes, input).slice(0, 8);
  }, [notes, input]);

  const actions = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      hint: string;
      icon: React.ReactNode;
      run: () => void;
    }> = [];

    if (input.trim()) {
      list.push({
        id: "create-query",
        label: `"${input.trim()}" başlıklı yeni not oluştur`,
        hint: "Yeni kart",
        icon: <Plus className="h-4 w-4 text-blue-500" />,
        run: () => {
          onCreateNote(input.trim());
          onClose();
        },
      });
    } else {
      list.push(
        {
          id: "create-blank",
          label: "Yeni boş not oluştur",
          hint: "N",
          icon: <Plus className="h-4 w-4 text-blue-500" />,
          run: () => {
            onCreateNote("");
            onClose();
          },
        },
        {
          id: "sync",
          label: "Turso bulut ile şimdi senkronize et",
          hint: "Bulut",
          icon: <RefreshCw className="h-4 w-4 text-emerald-500" />,
          run: () => {
            onSyncNow();
            onClose();
          },
        },
        {
          id: "theme",
          label: theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç",
          hint: "Tema",
          icon:
            theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-500" />
            ),
          run: () => {
            onToggleTheme();
            onClose();
          },
        },
        {
          id: "export",
          label: "Tüm notları JSON yedeği olarak indir",
          hint: "Yedek",
          icon: <Download className="h-4 w-4 text-[var(--text-secondary)]" />,
          run: () => {
            onExportJson();
            onClose();
          },
        }
      );
    }

    return list;
  }, [input, onClose, onCreateNote, onExportJson, onSyncNow, onToggleTheme, theme]);

  const totalItems = matches.length + actions.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [input]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (totalItems > 0 ? (i + 1) % totalItems : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          totalItems > 0 ? (i - 1 + totalItems) % totalItems : 0
        );
      } else if (e.key === "Tab" && activeIndex < matches.length) {
        e.preventDefault();
        const target = matches[activeIndex];
        if (target) {
          onClose();
          onPeekNote(target.note);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex < matches.length) {
          const target = matches[activeIndex];
          if (target) {
            onClose();
            onSelectNote(target.note);
          }
        } else {
          const action = actions[activeIndex - matches.length];
          action?.run();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, activeIndex, matches, onClose, onPeekNote, onSelectNote, totalItems]);

  return (
    <div
      className="glass-backdrop animate-fade-in fixed inset-0 z-50 flex items-start justify-center px-3 pt-[11vh] sm:px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong animate-peek-pop w-full max-w-xl overflow-hidden rounded-3xl">
        {/* Search Input */}
        <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3.5">
          <Search className="h-4.5 w-4.5 shrink-0 text-blue-500" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Not ara, #etiket, is:todo veya komut…"
            className="w-full bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <kbd className="hidden rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[58vh] overflow-y-auto p-2">
          {matches.length > 0 && (
            <div className="mb-1.5">
              <div className="px-2.5 py-1 text-[10.5px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                {input.trim() ? "Eşleşen Notlar" : "Hızlı Erişim (Akıllı Öncelik)"}
              </div>
              {matches.map((m, idx) => {
                const selected = idx === activeIndex;
                const colorMeta = getColorMeta(m.note.color);
                const frequent = isFrequentNote(m.note);
                return (
                  <div
                    key={m.note.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onClose();
                      onSelectNote(m.note);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition ${
                      selected
                        ? "bg-blue-500/14 text-[var(--text-primary)]"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${colorMeta.dot}`} />
                        <span className="truncate text-sm font-medium">
                          <HighlightText
                            text={deriveDisplayTitle(m.note)}
                            terms={m.matchedTerms}
                          />
                        </span>
                        {frequent && (
                          <Flame className="h-3 w-3 shrink-0 text-amber-500" />
                        )}
                      </div>
                      {m.snippet && (
                        <p className="mt-0.5 truncate pl-4 text-xs text-[var(--text-muted)]">
                          <HighlightText text={m.snippet} terms={m.matchedTerms} />
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Hızlı Bakış (Tab)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onPeekNote(m.note);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-black/8 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-70" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10.5px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                Komutlar
              </div>
              {actions.map((action, idx) => {
                const flatIdx = matches.length + idx;
                const selected = flatIdx === activeIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIdx)}
                    onClick={action.run}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                      selected
                        ? "bg-blue-500/14 text-[var(--text-primary)]"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-sm font-medium">
                      {action.icon}
                      <span>{action.label}</span>
                    </div>
                    <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-muted)] dark:bg-white/8">
                      {action.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>↵ Aç</span>
            <span>Tab Hızlı Bakış</span>
            <span>↑↓ Gezin</span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-500" />
            Türkçe akıllı arama
          </span>
        </div>
      </div>
    </div>
  );
}
