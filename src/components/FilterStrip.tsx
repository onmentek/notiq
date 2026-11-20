"use client";

import {
  Archive,
  CheckSquare,
  Clock,
  Flame,
  Hash,
  Layers,
  Pin,
} from "lucide-react";
import type { FilterMode } from "@/lib/types";

interface FilterStripProps {
  activeFilter: FilterMode;
  activeTag: string | null;
  onFilterChange: (filter: FilterMode) => void;
  onTagChange: (tag: string | null) => void;
  counts: {
    all: number;
    frequent: number;
    pinned: number;
    todo: number;
    recent: number;
    archived: number;
  };
  topTags: Array<{ tag: string; count: number }>;
}

export function FilterStrip({
  activeFilter,
  activeTag,
  onFilterChange,
  onTagChange,
  counts,
  topTags,
}: FilterStripProps) {
  const tabs: Array<{
    id: FilterMode;
    label: string;
    count: number;
    icon: React.ReactNode;
    accent?: string;
  }> = [
    { id: "all", label: "Tümü", count: counts.all, icon: <Layers className="h-3.5 w-3.5" /> },
    {
      id: "frequent",
      label: "Sık Kullanılan",
      count: counts.frequent,
      icon: <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />,
    },
    {
      id: "pinned",
      label: "Sabit",
      count: counts.pinned,
      icon: <Pin className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />,
    },
    {
      id: "todo",
      label: "Görevler",
      count: counts.todo,
      icon: <CheckSquare className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      id: "recent",
      label: "Son 24s",
      count: counts.recent,
      icon: <Clock className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 pt-1 pb-2 sm:px-5">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
        {tabs.map((tab) => {
          const isActive = !activeTag && activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onTagChange(null);
                onFilterChange(tab.id);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-sm"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-glass)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`tabular-nums text-[10px] ${
                    isActive ? "opacity-75" : "text-[var(--text-muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        {topTags.length > 0 && (
          <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
        )}

        {topTags.map(({ tag, count }) => {
          const isActive = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => {
                if (isActive) {
                  onTagChange(null);
                } else {
                  onFilterChange("all");
                  onTagChange(tag);
                }
              }}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/25"
                  : "border border-[var(--border-subtle)] bg-black/[0.025] text-[var(--text-secondary)] hover:border-blue-500/35 hover:text-blue-600 dark:bg-white/[0.03] dark:hover:text-blue-300"
              }`}
            >
              <Hash className="h-3 w-3 opacity-70" />
              <span>{tag}</span>
              <span className={`tabular-nums text-[10px] ${isActive ? "opacity-80" : "text-[var(--text-muted)]"}`}>
                {count}
              </span>
            </button>
          );
        })}

        {counts.archived > 0 && (
          <>
            <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <button
              type="button"
              onClick={() => {
                onTagChange(null);
                onFilterChange(activeFilter === "archived" ? "all" : "archived");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                !activeTag && activeFilter === "archived"
                  ? "bg-[var(--text-primary)] text-[var(--bg-canvas)]"
                  : "border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Arşiv</span>
              <span className="tabular-nums text-[10px] opacity-75">{counts.archived}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
