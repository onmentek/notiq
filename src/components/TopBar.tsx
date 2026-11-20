"use client";

import {
  ArrowDownUp,
  Check,
  Cloud,
  CloudOff,
  Command,
  LayoutGrid,
  List,
  Moon,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SortMode, SyncStatus, ViewMode } from "@/lib/types";

interface TopBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onQuickCreateFromQuery: (title: string) => void;
  onOpenCommandPalette: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  syncStatus: SyncStatus;
  onSyncNow: () => void;
  onOpenSettings: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  totalNotes: number;
}

const SORT_OPTIONS: Array<{ id: SortMode; label: string; hint: string }> = [
  { id: "smart", label: "Akıllı Öncelik", hint: "Sık kullanılanlar öne çıkar" },
  { id: "frequent", label: "En Çok Kullanılan", hint: "Açılma & yazma sayısına göre" },
  { id: "updated", label: "Son Düzenlenen", hint: "En güncel değişiklik üstte" },
  { id: "created", label: "Oluşturma Tarihi", hint: "En yeni kartlar üstte" },
];

export function TopBar({
  query,
  onQueryChange,
  onQuickCreateFromQuery,
  onOpenCommandPalette,
  sortMode,
  onSortChange,
  viewMode,
  onViewChange,
  theme,
  onToggleTheme,
  syncStatus,
  onSyncNow,
  onOpenSettings,
  searchInputRef,
  totalNotes,
}: TopBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [sortOpen]);

  const activeSort = SORT_OPTIONS.find((s) => s.id === sortMode) ?? SORT_OPTIONS[0];

  const cycleView = () => {
    const order: ViewMode[] = ["masonry", "compact", "list"];
    const next = order[(order.indexOf(viewMode) + 1) % order.length];
    onViewChange(next);
  };

  return (
    <header className="sticky top-0 z-30 safe-top px-3 pt-2.5 pb-1.5 sm:px-5">
      <div className="glass-panel mx-auto flex max-w-6xl items-center gap-2 rounded-2xl px-2.5 py-2 shadow-sm sm:gap-3 sm:px-3.5">
        {/* Brand + Sync Pill */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/25">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight">Notiq</span>
              <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-muted)] dark:bg-white/8">
                {totalNotes}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={syncStatus === "offline" ? onOpenSettings : onSyncNow}
            title={
              syncStatus === "synced"
                ? "Turso ile senkronize — yenilemek için tıkla"
                : syncStatus === "syncing"
                  ? "Senkronize ediliyor…"
                  : syncStatus === "offline"
                    ? "Yerel çevrimdışı mod — sunucu bağlamak için tıkla"
                    : "Senkronizasyon hatası — tekrar dene"
            }
            className="flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-black/[0.03] px-2 text-[11px] font-medium text-[var(--text-secondary)] transition hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            {syncStatus === "syncing" ? (
              <RefreshCw className="h-3 w-3 animate-spin text-amber-400" />
            ) : syncStatus === "synced" ? (
              <Cloud className="h-3 w-3 text-emerald-500" />
            ) : syncStatus === "error" ? (
              <CloudOff className="h-3 w-3 text-rose-400" />
            ) : (
              <CloudOff className="h-3 w-3 text-[var(--text-muted)]" />
            )}
            <span className="hidden md:inline">
              {syncStatus === "syncing"
                ? "Eşitleniyor"
                : syncStatus === "synced"
                  ? "Bulut"
                  : syncStatus === "error"
                    ? "Hata"
                    : "Yerel"}
            </span>
          </button>
        </div>

        {/* Unified Instant Search & Quick Create */}
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (query) {
                  onQueryChange("");
                } else {
                  e.currentTarget.blur();
                }
              } else if (e.key === "Enter" && query.trim() && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onQuickCreateFromQuery(query.trim());
                onQueryChange("");
              }
            }}
            placeholder="Ara, #etiket veya is:todo…"
            aria-label="Notlarda anında ara"
            className="h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] pr-20 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition outline-none focus:border-blue-500/50 focus:bg-white/70 focus:ring-2 focus:ring-blue-500/15 dark:bg-white/[0.04] dark:focus:bg-white/[0.07]"
          />

          <div className="absolute right-1.5 flex items-center gap-1">
            {query ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onQuickCreateFromQuery(query.trim());
                    onQueryChange("");
                  }}
                  title="Bu metinle yeni not oluştur (⌘Enter)"
                  className="flex h-6 items-center gap-1 rounded-lg bg-blue-500/15 px-2 text-[11px] font-medium text-blue-600 transition hover:bg-blue-500/25 dark:text-blue-300"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Ekle</span>
                </button>
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  aria-label="Aramayı temizle"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                title="Komut Paleti (⌘K)"
                className="hidden h-6 items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-black/[0.03] px-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text-primary)] sm:flex dark:bg-white/[0.05]"
              >
                <Command className="h-2.5 w-2.5" />
                <span>K</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Compact Controls */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Sort Dropdown */}
          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              title={`Sıralama: ${activeSort.label}`}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-black/[0.06] hover:text-[var(--text-primary)] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <ArrowDownUp className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span className="hidden lg:inline">{activeSort.label}</span>
            </button>

            {sortOpen && (
              <div className="glass-strong animate-peek-pop absolute right-0 mt-2 w-60 rounded-2xl p-1.5 z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Kart Sıralaması
                </div>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSortChange(opt.id);
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-start justify-between rounded-xl px-2.5 py-2 text-left transition ${
                      sortMode === opt.id
                        ? "bg-blue-500/12 text-blue-600 dark:text-blue-300"
                        : "hover:bg-black/5 dark:hover:bg-white/6"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {opt.hint}
                      </div>
                    </div>
                    {sortMode === opt.id && (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Cycle */}
          <button
            type="button"
            onClick={cycleView}
            title={
              viewMode === "masonry"
                ? "Görünüm: Kart Izgarası"
                : viewMode === "compact"
                  ? "Görünüm: Yoğun Izgara"
                  : "Görünüm: Akış Listesi"
            }
            className="hidden h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] text-[var(--text-secondary)] transition hover:bg-black/[0.06] hover:text-[var(--text-primary)] sm:flex dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            {viewMode === "masonry" ? (
              <LayoutGrid className="h-4 w-4" />
            ) : viewMode === "compact" ? (
              <Rows3 className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            aria-label="Temayı değiştir"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] text-[var(--text-secondary)] transition hover:bg-black/[0.06] hover:text-[var(--text-primary)] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-300" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600" />
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Ayarlar & Turso Senkronizasyonu"
            aria-label="Ayarları aç"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] text-[var(--text-secondary)] transition hover:bg-black/[0.06] hover:text-[var(--text-primary)] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
