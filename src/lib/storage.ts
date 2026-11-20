import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Note, SyncConfig } from "./types";

const NOTES_STORAGE_KEY = "notiq.notes.v1";
const SYNC_CONFIG_KEY = "notiq.sync.v1";
const SEEDED_KEY = "notiq.seeded.v1";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function triggerHaptic(style: "light" | "medium" = "light"): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({
      style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // ignore on unsupported devices
  }
}

export async function syncNativeStatusBar(theme: "dark" | "light"): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({
      style: theme === "dark" ? Style.Dark : Style.Light,
    });
    await StatusBar.setBackgroundColor({
      color: theme === "dark" ? "#0D0E11" : "#F7F6F3",
    });
  } catch {
    // ignore
  }
}

export function loadLocalNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalNotes(notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // quota error fallback
  }
}

export function hasBeenSeeded(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SEEDED_KEY) === "1";
}

export function markSeeded(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEDED_KEY, "1");
}

export function loadSyncConfig(): SyncConfig {
  const defaultUrl = process.env.NEXT_PUBLIC_DEFAULT_SYNC_URL?.trim() || "";
  if (typeof window === "undefined") {
    return { serverUrl: defaultUrl, syncSecret: "", lastSyncedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) {
      return { serverUrl: defaultUrl, syncSecret: "", lastSyncedAt: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      serverUrl: typeof parsed.serverUrl === "string" ? parsed.serverUrl : defaultUrl,
      syncSecret: typeof parsed.syncSecret === "string" ? parsed.syncSecret : "",
      lastSyncedAt: Number(parsed.lastSyncedAt) || 0,
    };
  } catch {
    return { serverUrl: defaultUrl, syncSecret: "", lastSyncedAt: 0 };
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

export function resolveApiBaseUrl(config: SyncConfig): string | null {
  const custom = config.serverUrl.trim().replace(/\/+$/, "");
  if (custom) return custom;
  if (isNativeApp()) {
    // On Android APK without a configured Vercel URL, run cleanly in local-first offline mode
    return null;
  }
  return ""; // Same-origin on Web / Vercel
}

function buildHeaders(config: SyncConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.syncSecret.trim()) {
    headers.Authorization = `Bearer ${config.syncSecret.trim()}`;
  }
  return headers;
}

export function mergeNotesLists(local: Note[], remote: Note[]): Note[] {
  const map = new Map<string, Note>();
  for (const n of local) {
    map.set(n.id, n);
  }
  for (const r of remote) {
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
      continue;
    }
    const openCount = Math.max(existing.openCount, r.openCount);
    const editCount = Math.max(existing.editCount, r.editCount);
    const totalFocusMs = Math.max(existing.totalFocusMs, r.totalFocusMs);
    const lastOpenedAt = Math.max(existing.lastOpenedAt, r.lastOpenedAt);

    if (r.updatedAt >= existing.updatedAt) {
      map.set(r.id, {
        ...r,
        openCount,
        editCount,
        totalFocusMs,
        lastOpenedAt,
      });
    } else {
      map.set(r.id, {
        ...existing,
        openCount,
        editCount,
        totalFocusMs,
        lastOpenedAt,
      });
    }
  }
  return Array.from(map.values());
}

export async function syncWithServer(
  localNotes: Note[],
  config: SyncConfig
): Promise<{ notes: Note[]; serverTime: number } | null> {
  const base = resolveApiBaseUrl(config);
  if (base === null) return null;

  const res = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify({
      notes: localNotes,
      since: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sunucu hatası (${res.status})`);
  }

  const data = (await res.json()) as { notes: Note[]; serverTime: number };
  const merged = mergeNotesLists(localNotes, data.notes || []);
  return { notes: merged, serverTime: data.serverTime || Date.now() };
}

export async function checkServerHealth(
  config: SyncConfig
): Promise<{ ok: boolean; mode: string; error?: string }> {
  const base = resolveApiBaseUrl(config);
  if (base === null) {
    return { ok: false, mode: "offline", error: "Sunucu URL girilmedi" };
  }
  try {
    const res = await fetch(`${base}/api/health`, {
      headers: buildHeaders(config),
    });
    if (!res.ok) {
      return { ok: false, mode: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: Boolean(data.ok), mode: data.database || "turso" };
  } catch (err) {
    return {
      ok: false,
      mode: "offline",
      error: err instanceof Error ? err.message : "Bağlantı kurulamadı",
    };
  }
}
