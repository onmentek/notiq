"use client";

import { Flame, Plus, Search, Settings } from "lucide-react";
import type { FilterMode } from "@/lib/types";

interface MobileDockProps {
  activeFilter: FilterMode;
  onNewNote: () => void;
  onFocusSearch: () => void;
  onToggleFrequent: () => void;
  onOpenSettings: () => void;
}

/**
 * Thumb-ergonomic translucent floating bottom dock for mobile & Android APK.
 */
export function MobileDock({
  activeFilter,
  onNewNote,
  onFocusSearch,
  onToggleFrequent,
  onOpenSettings,
}: MobileDockProps) {
  return (
    <nav
      aria-label="Hızlı alt menü"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-3 safe-bottom sm:hidden"
    >
      <div className="glass-strong pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5">
        <button
          type="button"
          onClick={onFocusSearch}
          aria-label="Ara"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition active:scale-95 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={onToggleFrequent}
          aria-label="Sık kullanılanlar"
          className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition active:scale-95 ${
            activeFilter === "frequent"
              ? "bg-amber-500/18 text-amber-500"
              : "text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          <Flame className="h-4 w-4" />
          <span>Sık</span>
        </button>

        <button
          type="button"
          onClick={onNewNote}
          className="flex h-10 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition active:scale-95 hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          <span>Hızlı Not</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Ayarlar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] transition active:scale-95 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      </div>
    </nav>
  );
}
