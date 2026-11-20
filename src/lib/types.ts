export type NoteColor =
  | "default"
  | "amber"
  | "sage"
  | "sky"
  | "lavender"
  | "rose";

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  openCount: number;
  editCount: number;
  totalFocusMs: number;
  lastOpenedAt: number; // unix ms
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
  deletedAt: number | null; // soft-delete for sync & undo
}

export type SortMode = "smart" | "updated" | "frequent" | "created";

export type FilterMode =
  | "all"
  | "frequent"
  | "pinned"
  | "todo"
  | "recent"
  | "archived";

export type ViewMode = "masonry" | "compact" | "list";

export interface SyncConfig {
  serverUrl: string; // "" means same-origin on Web; "https://..." for Android APK
  syncSecret: string;
  lastSyncedAt: number;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface SearchMatch {
  note: Note;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface ParsedLine {
  index: number;
  raw: string;
  isChecklist: boolean;
  checked: boolean;
  text: string;
}

export interface CardRect {
  top: number;
  left: number;
  width: number;
  height: number;
}
