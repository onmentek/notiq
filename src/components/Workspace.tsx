"use client";

import { App as CapApp } from "@capacitor/app";
import { Plus, RotateCcw, SearchX, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveDisplayTitle,
  extractTags,
  hasUncheckedTodo,
  isFrequentNote,
  sortNotes,
  toggleChecklistLine,
} from "@/lib/frecency";
import { searchNotes } from "@/lib/search";
import { createStarterNotes } from "@/lib/seed";
import {
  hasBeenSeeded,
  isNativeApp,
  loadLocalNotes,
  loadSyncConfig,
  markSeeded,
  mergeNotesLists,
  resolveApiBaseUrl,
  saveLocalNotes,
  saveSyncConfig,
  syncNativeStatusBar,
  syncWithServer,
  triggerHaptic,
} from "@/lib/storage";
import type {
  CardRect,
  FilterMode,
  Note,
  NoteColor,
  SortMode,
  SyncConfig,
  SyncStatus,
  ViewMode,
} from "@/lib/types";
import { CommandPalette } from "./CommandPalette";
import { FilterStrip } from "./FilterStrip";
import { MobileDock } from "./MobileDock";
import { NoteCard } from "./NoteCard";
import { NoteModal } from "./NoteModal";
import { PeekOverlay } from "./PeekOverlay";
import { QuickCaptureBar } from "./QuickCaptureBar";
import { SettingsDrawer } from "./SettingsDrawer";
import { TopBar } from "./TopBar";

const PREFS_KEY = "notiq.prefs.v1";

interface ToastState {
  message: string;
  undo?: () => void;
}

export function Workspace() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("smart");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("masonry");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [modalOriginRect, setModalOriginRect] = useState<CardRect | null>(null);
  const [switchDir, setSwitchDir] = useState<"next" | "prev" | null>(null);
  const [peekNoteId, setPeekNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    serverUrl: "",
    syncSecret: "",
    lastSyncedAt: 0,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [toast, setToast] = useState<ToastState | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<Note[]>([]);
  const visibleNotesRef = useRef<Note[]>([]);
  const syncConfigRef = useRef<SyncConfig>(syncConfig);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  notesRef.current = notes;
  syncConfigRef.current = syncConfig;

  const showToast = useCallback((message: string, undo?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, undo });
    toastTimerRef.current = setTimeout(() => setToast(null), 4600);
  }, []);

  const performSync = useCallback(
    async (explicitNotes?: Note[], explicitConfig?: SyncConfig) => {
      const cfg = explicitConfig ?? syncConfigRef.current;
      const base = resolveApiBaseUrl(cfg);
      if (base === null) {
        setSyncStatus("offline");
        return null;
      }

      setSyncStatus("syncing");
      try {
        const currentNotes = explicitNotes ?? notesRef.current;
        const result = await syncWithServer(currentNotes, cfg);
        if (!result) {
          setSyncStatus("offline");
          return null;
        }
        setNotes(result.notes);
        saveLocalNotes(result.notes);
        const nextCfg = { ...cfg, lastSyncedAt: result.serverTime };
        setSyncConfig(nextCfg);
        saveSyncConfig(nextCfg);
        setSyncStatus("synced");
        return result.notes;
      } catch {
        setSyncStatus("error");
        return null;
      }
    },
    []
  );

  const scheduleSync = useCallback(
    (nextNotes: Note[]) => {
      saveLocalNotes(nextNotes);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        void performSync(nextNotes);
      }, 650);
    },
    [performSync]
  );

  // Initial client boot: theme, prefs, local notes, initial Turso sync & starter seed
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    void syncNativeStatusBar(isDark ? "dark" : "light");

    try {
      const rawPrefs = window.localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const p = JSON.parse(rawPrefs);
        if (p.sortMode) setSortMode(p.sortMode);
        if (p.viewMode) setViewMode(p.viewMode);
      }
    } catch {
      // ignore
    }

    const cfg = loadSyncConfig();
    setSyncConfig(cfg);
    syncConfigRef.current = cfg;

    const local = loadLocalNotes();
    if (local.length > 0) {
      setNotes(local);
      notesRef.current = local;
    }
    setHydrated(true);

    // Sync with Turso if online; seed starter notes only if both local & remote are empty
    (async () => {
      const synced = await performSync(local, cfg);
      const effective = synced ?? local;
      if (effective.filter((n) => !n.deletedAt).length === 0 && !hasBeenSeeded()) {
        const starter = createStarterNotes();
        markSeeded();
        setNotes(starter);
        notesRef.current = starter;
        saveLocalNotes(starter);
        void performSync(starter, cfg);
      }
    })();
  }, [performSync]);

  // Persist view/sort preferences
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ sortMode, viewMode })
      );
    } catch {
      // ignore
    }
  }, [hydrated, sortMode, viewMode]);

  // Sync when regaining network or returning to tab
  useEffect(() => {
    const onFocusOrOnline = () => {
      if (navigator.onLine) {
        void performSync();
      }
    };
    window.addEventListener("online", onFocusOrOnline);
    window.addEventListener("focus", onFocusOrOnline);
    return () => {
      window.removeEventListener("online", onFocusOrOnline);
      window.removeEventListener("focus", onFocusOrOnline);
    };
  }, [performSync]);

  // Android native hardware back button handler
  useEffect(() => {
    if (!isNativeApp()) return;
    let removeListener: (() => void) | undefined;
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (settingsOpen) {
        setSettingsOpen(false);
      } else if (commandOpen) {
        setCommandOpen(false);
      } else if (peekNoteId) {
        setPeekNoteId(null);
      } else if (activeNoteId) {
        setActiveNoteId(null);
      } else if (quickCaptureOpen) {
        setQuickCaptureOpen(false);
      } else if (query) {
        setQuery("");
      } else if (!canGoBack) {
        void CapApp.exitApp();
      }
    }).then((handle) => {
      removeListener = () => void handle.remove();
    });

    return () => removeListener?.();
  }, [activeNoteId, commandOpen, peekNoteId, query, quickCaptureOpen, settingsOpen]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }

      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (inInput || activeNoteId || commandOpen || settingsOpen || peekNoteId) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setQuickCaptureOpen(true);
      } else if (e.key === " " && hoveredNoteId) {
        e.preventDefault();
        setPeekNoteId(hoveredNoteId);
      } else if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key >= "1" &&
        e.key <= "5"
      ) {
        const idx = Number(e.key) - 1;
        const targetNote = visibleNotesRef.current[idx];
        if (targetNote) {
          e.preventDefault();
          const now = Date.now();
          const next = notesRef.current.map((n) =>
            n.id === targetNote.id
              ? { ...n, openCount: n.openCount + 1, lastOpenedAt: now }
              : n
          );
          setNotes(next);
          scheduleSync(next);
          setModalOriginRect(null);
          setSwitchDir(null);
          setActiveNoteId(targetNote.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNoteId, commandOpen, hoveredNoteId, peekNoteId, scheduleSync, settingsOpen]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      window.localStorage.setItem("notiq.theme", next);
      void syncNativeStatusBar(next);
      return next;
    });
  }, []);

  const handleCreateNote = useCallback(
    (
      draft: {
        title?: string;
        content?: string;
        color?: NoteColor;
        isPinned?: boolean;
      },
      openImmediately = false
    ) => {
      const now = Date.now();
      const title = (draft.title ?? "").trim();
      const content = draft.content ?? "";
      const newNote: Note = {
        id: crypto.randomUUID(),
        title,
        content,
        color: draft.color ?? "default",
        tags: extractTags(title, content),
        isPinned: Boolean(draft.isPinned),
        isArchived: false,
        openCount: 1,
        editCount: 1,
        totalFocusMs: 0,
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      markSeeded();
      const next = [newNote, ...notesRef.current];
      setNotes(next);
      scheduleSync(next);
      triggerHaptic("light");

      if (openImmediately) {
        setModalOriginRect(null);
        setSwitchDir(null);
        setActiveNoteId(newNote.id);
      } else {
        showToast("Not oluşturuldu");
      }
    },
    [scheduleSync, showToast]
  );

  const handleUpdateNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      const now = Date.now();
      const next = notesRef.current.map((n) => {
        if (n.id !== id) return n;
        const nextTitle = patch.title !== undefined ? patch.title : n.title;
        const nextContent = patch.content !== undefined ? patch.content : n.content;
        const contentChanged = nextTitle !== n.title || nextContent !== n.content;
        return {
          ...n,
          ...patch,
          title: nextTitle,
          content: nextContent,
          tags: extractTags(nextTitle, nextContent),
          editCount: contentChanged ? n.editCount + 1 : n.editCount,
          updatedAt: now,
        };
      });
      setNotes(next);
      scheduleSync(next);
    },
    [scheduleSync]
  );

  const handleOpenNote = useCallback(
    (note: Note, rect: CardRect | null = null, direction: "next" | "prev" | null = null) => {
      const now = Date.now();
      const next = notesRef.current.map((n) =>
        n.id === note.id
          ? {
              ...n,
              openCount: n.openCount + 1,
              lastOpenedAt: now,
            }
          : n
      );
      setNotes(next);
      scheduleSync(next);
      setModalOriginRect(rect);
      setSwitchDir(direction);
      setActiveNoteId(note.id);
      triggerHaptic("light");
    },
    [scheduleSync]
  );

  const handleDeleteNote = useCallback(
    (note: Note) => {
      const now = Date.now();
      const next = notesRef.current.map((n) =>
        n.id === note.id ? { ...n, deletedAt: now, updatedAt: now } : n
      );
      setNotes(next);
      scheduleSync(next);
      triggerHaptic("medium");

      showToast(`"${deriveDisplayTitle(note)}" silindi`, () => {
        const restoredAt = Date.now();
        const restored = notesRef.current.map((n) =>
          n.id === note.id ? { ...n, deletedAt: null, updatedAt: restoredAt } : n
        );
        setNotes(restored);
        scheduleSync(restored);
      });
    },
    [scheduleSync, showToast]
  );

  const handleToggleArchive = useCallback(
    (note: Note) => {
      const nextArchived = !note.isArchived;
      handleUpdateNote(note.id, { isArchived: nextArchived });
      showToast(
        nextArchived ? "Not arşivlendi" : "Not arşivden çıkarıldı",
        () => handleUpdateNote(note.id, { isArchived: !nextArchived })
      );
    },
    [handleUpdateNote, showToast]
  );

  const handleToggleChecklist = useCallback(
    (note: Note, lineIndex: number) => {
      const nextContent = toggleChecklistLine(note.content, lineIndex);
      if (nextContent !== note.content) {
        triggerHaptic("light");
        handleUpdateNote(note.id, { content: nextContent });
      }
    },
    [handleUpdateNote]
  );

  // Derived active counts & top tags
  const { counts, topTags } = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    const tagMap = new Map<string, number>();

    let all = 0;
    let frequent = 0;
    let pinned = 0;
    let todo = 0;
    let recent = 0;
    let archived = 0;

    for (const n of notes) {
      if (n.deletedAt) continue;
      if (n.isArchived) {
        archived++;
        continue;
      }
      all++;
      if (isFrequentNote(n, now)) frequent++;
      if (n.isPinned) pinned++;
      if (hasUncheckedTodo(n.content)) todo++;
      if (n.updatedAt >= dayAgo || n.lastOpenedAt >= dayAgo) recent++;

      for (const t of n.tags) {
        tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
      }
    }

    const sortedTags = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    return {
      counts: { all, frequent, pinned, todo, recent, archived },
      topTags: sortedTags,
    };
  }, [notes]);

  // Visible filtered & smart-sorted notes
  const { visibleNotes, highlightTerms } = useMemo(() => {
    const now = Date.now();
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      const matches = searchNotes(notes, trimmedQuery, now);
      return {
        visibleNotes: matches.map((m) => m.note),
        highlightTerms: matches[0]?.matchedTerms ?? [],
      };
    }

    const dayAgo = now - 86_400_000;
    const filtered = notes.filter((n) => {
      if (n.deletedAt) return false;
      if (activeTag) {
        return !n.isArchived && n.tags.includes(activeTag);
      }
      switch (filterMode) {
        case "archived":
          return n.isArchived;
        case "pinned":
          return !n.isArchived && n.isPinned;
        case "frequent":
          return !n.isArchived && isFrequentNote(n, now);
        case "todo":
          return !n.isArchived && hasUncheckedTodo(n.content);
        case "recent":
          return !n.isArchived && (n.updatedAt >= dayAgo || n.lastOpenedAt >= dayAgo);
        case "all":
        default:
          return !n.isArchived;
      }
    });

    return {
      visibleNotes: sortNotes(filtered, sortMode, now),
      highlightTerms: [] as string[],
    };
  }, [activeTag, filterMode, notes, query, sortMode]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId && !n.deletedAt) ?? null,
    [activeNoteId, notes]
  );
  visibleNotesRef.current = visibleNotes;

  const peekNote = useMemo(
    () => notes.find((n) => n.id === peekNoteId && !n.deletedAt) ?? null,
    [peekNoteId, notes]
  );

  // Export & Import helpers
  const handleExportJson = useCallback(() => {
    const active = notesRef.current.filter((n) => !n.deletedAt);
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), notes: active }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notiq-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON yedeği indirildi");
  }, [showToast]);

  const handleExportMarkdown = useCallback(() => {
    const active = sortNotes(
      notesRef.current.filter((n) => !n.deletedAt && !n.isArchived),
      "updated"
    );
    const md = active
      .map((n) => `# ${deriveDisplayTitle(n)}\n\n${n.content}\n`)
      .join("\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notiq-notlar-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Markdown dosyası indirildi");
  }, [showToast]);

  const handleImportJson = useCallback(
    (imported: Note[]) => {
      const merged = mergeNotesLists(notesRef.current, imported);
      setNotes(merged);
      scheduleSync(merged);
      showToast(`${imported.length} not içe aktarıldı`);
    },
    [scheduleSync, showToast]
  );

  // Layout grid classes
  const gridClass =
    viewMode === "list"
      ? "flex flex-col gap-2"
      : viewMode === "compact"
        ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
        : "columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 [&>article]:mb-3 [&>article]:break-inside-avoid";

  return (
    <div className="min-h-screen pb-24 sm:pb-12">
      <TopBar
        query={query}
        onQueryChange={setQuery}
        onQuickCreateFromQuery={(text) => handleCreateNote({ title: text }, true)}
        onOpenCommandPalette={() => setCommandOpen(true)}
        sortMode={sortMode}
        onSortChange={setSortMode}
        viewMode={viewMode}
        onViewChange={setViewMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        syncStatus={syncStatus}
        onSyncNow={() => void performSync()}
        onOpenSettings={() => setSettingsOpen(true)}
        searchInputRef={searchInputRef}
        totalNotes={counts.all}
      />

      <FilterStrip
        activeFilter={filterMode}
        activeTag={activeTag}
        onFilterChange={setFilterMode}
        onTagChange={setActiveTag}
        counts={counts}
        topTags={topTags}
      />

      {filterMode !== "archived" && (
        <QuickCaptureBar
          expanded={quickCaptureOpen}
          onExpandedChange={setQuickCaptureOpen}
          onCreate={(draft) => handleCreateNote(draft, false)}
        />
      )}

      {/* Main Card Canvas */}
      <main className="mx-auto max-w-6xl px-3 sm:px-5">
        {!hydrated ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-60"
              />
            ))}
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="glass-panel mx-auto mt-10 flex max-w-md flex-col items-center rounded-3xl px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-500">
              {query ? <SearchX className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <h2 className="mt-3 text-base font-semibold">
              {query
                ? `"${query}" ile eşleşen not yok`
                : filterMode === "frequent"
                  ? "Henüz sık kullanılan kart oluşmadı"
                  : filterMode === "archived"
                    ? "Arşiv boş"
                    : "Burası tertemiz"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {query
                ? "Bu metinle anında yeni bir not oluşturabilir veya aramayı temizleyebilirsin."
                : "Bir karta girip üstten hızlıca yazmaya başla; sık kullandığın kartlar otomatik öne çıkar."}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {query ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleCreateNote({ title: query.trim() }, true);
                      setQuery("");
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>"{query.trim()}" Oluştur</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-xl border border-[var(--border-strong)] px-3.5 py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/8"
                  >
                    Temizle
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (filterMode !== "all" || activeTag) {
                      setFilterMode("all");
                      setActiveTag(null);
                    } else {
                      handleCreateNote({}, true);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {filterMode !== "all" || activeTag
                      ? "Tüm Notları Göster"
                      : "İlk Notu Oluştur"}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <section aria-label="Not kartları" className={gridClass}>
            {visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                viewMode={viewMode}
                highlightTerms={highlightTerms}
                onOpen={(n, rect) => handleOpenNote(n, rect, null)}
                onPeek={(n) => setPeekNoteId(n.id)}
                onHoverChange={setHoveredNoteId}
                onTogglePin={(n) =>
                  handleUpdateNote(n.id, { isPinned: !n.isPinned })
                }
                onToggleArchive={handleToggleArchive}
                onDelete={handleDeleteNote}
                onToggleChecklist={handleToggleChecklist}
                onSelectTag={(tag) => {
                  setActiveTag(tag);
                  setFilterMode("all");
                }}
              />
            ))}
          </section>
        )}
      </main>

      {/* Mobile / Android Thumb Dock */}
      {!activeNote && !peekNote && !commandOpen && !settingsOpen && (
        <MobileDock
          activeFilter={filterMode}
          onNewNote={() => handleCreateNote({}, true)}
          onFocusSearch={() => searchInputRef.current?.focus()}
          onToggleFrequent={() => {
            setActiveTag(null);
            setFilterMode((prev) => (prev === "frequent" ? "all" : "frequent"));
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Expanding Glass Card Modal with Top-First Writing & Rapid Switcher */}
      {activeNote && (
        <NoteModal
          note={activeNote}
          originRect={modalOriginRect}
          siblingNotes={visibleNotes.length > 0 ? visibleNotes : notes.filter((n) => !n.deletedAt && !n.isArchived)}
          onClose={() => {
            setActiveNoteId(null);
            setSwitchDir(null);
          }}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
          onSwitchNote={(target, dir) => handleOpenNote(target, null, dir ?? null)}
          switchDirection={switchDir}
        />
      )}

      {/* Translucent Quick-Peek Overlay */}
      {peekNote && !activeNote && (
        <PeekOverlay
          note={peekNote}
          onClose={() => setPeekNoteId(null)}
          onOpenFull={(n) => handleOpenNote(n, null, null)}
          onToggleChecklist={handleToggleChecklist}
        />
      )}

      {/* ⌘K Translucent Command Palette */}
      {commandOpen && (
        <CommandPalette
          notes={notes}
          theme={theme}
          onClose={() => setCommandOpen(false)}
          onSelectNote={(n) => handleOpenNote(n, null, null)}
          onPeekNote={(n) => setPeekNoteId(n.id)}
          onCreateNote={(title) => handleCreateNote({ title }, true)}
          onToggleTheme={toggleTheme}
          onSyncNow={() => void performSync()}
          onExportJson={handleExportJson}
        />
      )}

      {/* Translucent Settings & Turso Sync Drawer */}
      {settingsOpen && (
        <SettingsDrawer
          syncConfig={syncConfig}
          syncStatus={syncStatus}
          notes={notes}
          onClose={() => setSettingsOpen(false)}
          onSaveSyncConfig={(nextCfg) => {
            setSyncConfig(nextCfg);
            saveSyncConfig(nextCfg);
          }}
          onSyncNow={() => void performSync()}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onImportJson={handleImportJson}
        />
      )}

      {/* Floating Translucent Undo Toast */}
      {toast && (
        <div className="glass-strong animate-toast-rise fixed bottom-20 left-1/2 z-50 flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium shadow-xl sm:bottom-6">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
              className="flex items-center gap-1 rounded-full bg-blue-500/18 px-2.5 py-1 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-500/28 dark:text-blue-300"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Geri Al</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
