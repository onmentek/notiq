import { createClient, type Client, type Row } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { extractTags, prependToContent } from "./frecency";
import type { Note, NoteColor } from "./types";

let clientInstance: Client | null = null;
let initializedPromise: Promise<void> | null = null;

export function isRemoteTurso(): boolean {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  return Boolean(url && !url.startsWith("file:"));
}

export function getDbClient(): Client {
  if (clientInstance) return clientInstance;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (url) {
    if (url.startsWith("file:")) {
      const filePath = url.slice(5);
      const dir = path.dirname(path.resolve(filePath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    clientInstance = createClient({
      url,
      authToken: authToken || undefined,
    });
  } else {
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    clientInstance = createClient({
      url: `file:${path.join(dataDir, "notes.db")}`,
    });
  }

  return clientInstance;
}

export async function ensureDbSchema(): Promise<Client> {
  const db = getDbClient();
  if (!initializedPromise) {
    initializedPromise = (async () => {
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT 'default',
          tags TEXT NOT NULL DEFAULT '[]',
          is_pinned INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          open_count INTEGER NOT NULL DEFAULT 0,
          edit_count INTEGER NOT NULL DEFAULT 0,
          total_focus_ms INTEGER NOT NULL DEFAULT 0,
          last_opened_at INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_notes_active_updated
          ON notes (deleted_at, is_archived, is_pinned DESC, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_notes_updated
          ON notes (updated_at DESC);

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
          note_id UNINDEXED,
          title,
          content,
          tags,
          tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
          INSERT INTO notes_fts(note_id, title, content, tags)
          VALUES (new.id, new.title, new.content, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
          DELETE FROM notes_fts WHERE note_id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
          DELETE FROM notes_fts WHERE note_id = old.id;
          INSERT INTO notes_fts(note_id, title, content, tags)
          VALUES (new.id, new.title, new.content, new.tags);
        END;
      `);
    })().catch((err) => {
      initializedPromise = null;
      throw err;
    });
  }
  await initializedPromise;
  return db;
}

function rowToNote(row: Row): Note {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags ?? "[]"));
    if (Array.isArray(parsed)) {
      tags = parsed.map(String);
    }
  } catch {
    tags = [];
  }

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    color: (String(row.color ?? "default") as NoteColor) || "default",
    tags,
    isPinned: Number(row.is_pinned ?? 0) === 1,
    isArchived: Number(row.is_archived ?? 0) === 1,
    openCount: Number(row.open_count ?? 0),
    editCount: Number(row.edit_count ?? 0),
    totalFocusMs: Number(row.total_focus_ms ?? 0),
    lastOpenedAt: Number(row.last_opened_at ?? 0),
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
    deletedAt: row.deleted_at === null || row.deleted_at === undefined ? null : Number(row.deleted_at),
  };
}

export async function listNotes(options?: {
  query?: string;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  since?: number;
}): Promise<Note[]> {
  const db = await ensureDbSchema();
  const q = options?.query?.trim();

  if (q) {
    // Sanitize FTS5 query tokens and append prefix wildcard
    const ftsQuery = q
      .replace(/["'()*^:]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(" AND ");

    if (ftsQuery) {
      const result = await db.execute({
        sql: `
          SELECT n.*
          FROM notes n
          INNER JOIN notes_fts f ON f.note_id = n.id
          WHERE notes_fts MATCH ?
            AND n.deleted_at IS NULL
            ${options?.includeArchived ? "" : "AND n.is_archived = 0"}
          ORDER BY bm25(notes_fts, 10.0, 2.0, 4.0) ASC, n.updated_at DESC
          LIMIT 200
        `,
        args: [ftsQuery],
      });
      return result.rows.map(rowToNote);
    }
  }

  const conditions: string[] = [];
  const args: Array<string | number> = [];

  if (!options?.includeDeleted) {
    conditions.push("deleted_at IS NULL");
  }
  if (!options?.includeArchived && !options?.since) {
    conditions.push("is_archived = 0");
  }
  if (options?.since && options.since > 0) {
    conditions.push("updated_at > ?");
    args.push(options.since);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT * FROM notes ${where} ORDER BY is_pinned DESC, updated_at DESC LIMIT 500`,
    args,
  });

  return result.rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const db = await ensureDbSchema();
  const result = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ? LIMIT 1",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToNote(result.rows[0]);
}

export async function createNote(input: Partial<Note> & { id?: string }): Promise<Note> {
  const db = await ensureDbSchema();
  const now = Date.now();
  const id = input.id?.trim() || crypto.randomUUID();
  const title = (input.title ?? "").trim();
  const content = input.content ?? "";
  const tags = extractTags(title, content);

  const note: Note = {
    id,
    title,
    content,
    color: input.color ?? "default",
    tags,
    isPinned: Boolean(input.isPinned),
    isArchived: Boolean(input.isArchived),
    openCount: input.openCount ?? 1,
    editCount: input.editCount ?? 1,
    totalFocusMs: input.totalFocusMs ?? 0,
    lastOpenedAt: input.lastOpenedAt ?? now,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    deletedAt: input.deletedAt ?? null,
  };

  await db.execute({
    sql: `
      INSERT INTO notes (
        id, title, content, color, tags, is_pinned, is_archived,
        open_count, edit_count, total_focus_ms, last_opened_at,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        color = excluded.color,
        tags = excluded.tags,
        is_pinned = excluded.is_pinned,
        is_archived = excluded.is_archived,
        open_count = MAX(notes.open_count, excluded.open_count),
        edit_count = MAX(notes.edit_count, excluded.edit_count),
        total_focus_ms = MAX(notes.total_focus_ms, excluded.total_focus_ms),
        last_opened_at = MAX(notes.last_opened_at, excluded.last_opened_at),
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    args: [
      note.id,
      note.title,
      note.content,
      note.color,
      JSON.stringify(note.tags),
      note.isPinned ? 1 : 0,
      note.isArchived ? 1 : 0,
      note.openCount,
      note.editCount,
      note.totalFocusMs,
      note.lastOpenedAt,
      note.createdAt,
      note.updatedAt,
      note.deletedAt,
    ],
  });

  return note;
}

export async function updateNote(
  id: string,
  patch: Partial<Note> & {
    prependText?: string;
    prependAsChecklist?: boolean;
    prependWithTimestamp?: boolean;
  }
): Promise<Note | null> {
  const existing = await getNoteById(id);
  if (!existing) return null;

  const now = Date.now();
  const nextTitle = patch.title !== undefined ? patch.title : existing.title;
  let nextContent = patch.content !== undefined ? patch.content : existing.content;

  if (patch.prependText?.trim()) {
    nextContent = prependToContent(nextContent, patch.prependText, {
      asChecklist: patch.prependAsChecklist,
      withTimestamp: patch.prependWithTimestamp,
    });
  }

  const contentChanged =
    nextTitle !== existing.title || nextContent !== existing.content;
  const nextTags = extractTags(nextTitle, nextContent);

  const updated: Note = {
    ...existing,
    title: nextTitle,
    content: nextContent,
    color: patch.color ?? existing.color,
    tags: nextTags,
    isPinned: patch.isPinned !== undefined ? patch.isPinned : existing.isPinned,
    isArchived:
      patch.isArchived !== undefined ? patch.isArchived : existing.isArchived,
    openCount: patch.openCount ?? existing.openCount,
    editCount:
      patch.editCount ??
      (contentChanged ? existing.editCount + 1 : existing.editCount),
    totalFocusMs: patch.totalFocusMs ?? existing.totalFocusMs,
    lastOpenedAt: patch.lastOpenedAt ?? existing.lastOpenedAt,
    updatedAt: patch.updatedAt ?? now,
    deletedAt:
      patch.deletedAt !== undefined ? patch.deletedAt : existing.deletedAt,
  };

  const db = await ensureDbSchema();
  await db.execute({
    sql: `
      UPDATE notes SET
        title = ?,
        content = ?,
        color = ?,
        tags = ?,
        is_pinned = ?,
        is_archived = ?,
        open_count = ?,
        edit_count = ?,
        total_focus_ms = ?,
        last_opened_at = ?,
        updated_at = ?,
        deleted_at = ?
      WHERE id = ?
    `,
    args: [
      updated.title,
      updated.content,
      updated.color,
      JSON.stringify(updated.tags),
      updated.isPinned ? 1 : 0,
      updated.isArchived ? 1 : 0,
      updated.openCount,
      updated.editCount,
      updated.totalFocusMs,
      updated.lastOpenedAt,
      updated.updatedAt,
      updated.deletedAt,
      id,
    ],
  });

  return updated;
}

export async function touchNote(
  id: string,
  delta?: { openDelta?: number; focusMsDelta?: number }
): Promise<Note | null> {
  const existing = await getNoteById(id);
  if (!existing) return null;

  const now = Date.now();
  const openCount = existing.openCount + (delta?.openDelta ?? 1);
  const totalFocusMs = existing.totalFocusMs + Math.max(0, delta?.focusMsDelta ?? 0);

  const db = await ensureDbSchema();
  await db.execute({
    sql: `
      UPDATE notes SET
        open_count = ?,
        total_focus_ms = ?,
        last_opened_at = ?
      WHERE id = ?
    `,
    args: [openCount, totalFocusMs, now, id],
  });

  return {
    ...existing,
    openCount,
    totalFocusMs,
    lastOpenedAt: now,
  };
}

export async function softDeleteNote(id: string): Promise<boolean> {
  const db = await ensureDbSchema();
  const now = Date.now();
  const res = await db.execute({
    sql: "UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
    args: [now, now, id],
  });
  return res.rowsAffected > 0;
}

/**
 * Bidirectional delta sync with Last-Write-Wins (updatedAt) + monotonic telemetry merge.
 */
export async function syncNotesBatch(
  clientNotes: Note[],
  since = 0
): Promise<{ notes: Note[]; serverTime: number }> {
  const db = await ensureDbSchema();
  const serverTime = Date.now();

  for (const incoming of clientNotes) {
    if (!incoming?.id) continue;
    const existing = await getNoteById(incoming.id);
    const normalizedTags = extractTags(incoming.title ?? "", incoming.content ?? "");

    if (!existing) {
      await createNote({
        ...incoming,
        tags: normalizedTags,
      });
      continue;
    }

    const mergedOpenCount = Math.max(existing.openCount, incoming.openCount || 0);
    const mergedEditCount = Math.max(existing.editCount, incoming.editCount || 0);
    const mergedFocusMs = Math.max(existing.totalFocusMs, incoming.totalFocusMs || 0);
    const mergedLastOpened = Math.max(existing.lastOpenedAt, incoming.lastOpenedAt || 0);

    if ((incoming.updatedAt || 0) >= existing.updatedAt) {
      await updateNote(incoming.id, {
        title: incoming.title ?? "",
        content: incoming.content ?? "",
        color: incoming.color ?? "default",
        isPinned: Boolean(incoming.isPinned),
        isArchived: Boolean(incoming.isArchived),
        openCount: mergedOpenCount,
        editCount: mergedEditCount,
        totalFocusMs: mergedFocusMs,
        lastOpenedAt: mergedLastOpened,
        updatedAt: incoming.updatedAt || serverTime,
        deletedAt: incoming.deletedAt ?? null,
      });
    } else if (
      mergedOpenCount > existing.openCount ||
      mergedFocusMs > existing.totalFocusMs ||
      mergedLastOpened > existing.lastOpenedAt
    ) {
      await db.execute({
        sql: `
          UPDATE notes SET
            open_count = ?,
            total_focus_ms = ?,
            last_opened_at = ?
          WHERE id = ?
        `,
        args: [mergedOpenCount, mergedFocusMs, mergedLastOpened, existing.id],
      });
    }
  }

  const allUpdated = await listNotes({
    includeArchived: true,
    includeDeleted: since > 0,
    since,
  });

  return { notes: allUpdated, serverTime };
}
