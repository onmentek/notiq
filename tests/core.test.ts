import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  computeFrecencyScore,
  extractTags,
  isFrequentNote,
  prependToContent,
  sortNotes,
  toggleChecklistLine,
} from "../src/lib/frecency";
import {
  getHighlightSegments,
  normalizeText,
  searchNotes,
} from "../src/lib/search";
import type { Note } from "../src/lib/types";

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Test Notu",
    content: "İçerik metni",
    color: "default",
    tags: [],
    isPinned: false,
    isArchived: false,
    openCount: 1,
    editCount: 1,
    totalFocusMs: 0,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("Frecency & Smart Sorting", () => {
  it("ranks frequently used recent cards above rarely opened ones", () => {
    const now = Date.now();
    const quiet = makeNote({
      title: "Nadir Kart",
      openCount: 1,
      editCount: 1,
      lastOpenedAt: now - 48 * 3_600_000,
      updatedAt: now - 48 * 3_600_000,
    });
    const frequent = makeNote({
      title: "Sık Kart",
      openCount: 12,
      editCount: 6,
      lastOpenedAt: now - 10 * 60_000,
      updatedAt: now - 10 * 60_000,
    });

    assert.ok(computeFrecencyScore(frequent, now) > computeFrecencyScore(quiet, now));
    assert.equal(isFrequentNote(frequent, now), true);
    assert.equal(isFrequentNote(quiet, now), false);

    const sorted = sortNotes([quiet, frequent], "smart", now);
    assert.equal(sorted[0].title, "Sık Kart");
  });

  it("keeps pinned notes at the top regardless of sort mode", () => {
    const now = Date.now();
    const pinned = makeNote({
      title: "Sabit",
      isPinned: true,
      openCount: 1,
      editCount: 1,
      updatedAt: now - 100_000,
    });
    const hot = makeNote({
      title: "Çok Sık",
      isPinned: false,
      openCount: 30,
      editCount: 20,
      updatedAt: now,
    });

    const sorted = sortNotes([hot, pinned], "smart", now);
    assert.equal(sorted[0].title, "Sabit");
  });
});

describe("Top-First Quick Write & Checklists", () => {
  it("prepends new lines cleanly to the very top of existing content", () => {
    const next = prependToContent("Eski satır 1\nEski satır 2", "Yeni üst satır");
    assert.equal(next, "Yeni üst satır\nEski satır 1\nEski satır 2");
  });

  it("formats checklist items on top prepend", () => {
    const next = prependToContent("- [x] Eski görev", "Süt al", {
      asChecklist: true,
    });
    assert.equal(next, "- [ ] Süt al\n- [x] Eski görev");
  });

  it("toggles specific checklist lines without disturbing others", () => {
    const src = "- [ ] Birinci\nNormal metin\n- [x] İkinci";
    const toggled = toggleChecklistLine(src, 0);
    assert.equal(toggled, "- [x] Birinci\nNormal metin\n- [x] İkinci");
    const toggledBack = toggleChecklistLine(toggled, 2);
    assert.equal(toggledBack, "- [x] Birinci\nNormal metin\n- [ ] İkinci");
  });

  it("extracts Turkish #tags accurately", () => {
    const tags = extractTags("Toplantı #İş", "Önemli #alışveriş ve #tasarım-2026");
    assert.deepEqual(tags, ["iş", "alışveriş", "tasarım-2026"]);
  });
});

describe("Turkish-Aware Instant Search", () => {
  it("normalizes Turkish characters so ASCII queries match diacritics", () => {
    assert.equal(normalizeText("Alışveriş İstanbul Çiçek"), "alisveris istanbul cicek");

    const notes = [
      makeNote({
        title: "Alışveriş Listesi",
        content: "- [ ] Filtre kahve\n- [ ] Zeytinyağı #ev",
        tags: ["ev"],
      }),
      makeNote({
        title: "İstanbul Gezi Planı",
        content: "Galata ve Karaköy #seyahat",
        tags: ["seyahat"],
      }),
    ];

    const res1 = searchNotes(notes, "alisveris");
    assert.equal(res1.length, 1);
    assert.equal(res1[0].note.title, "Alışveriş Listesi");

    const res2 = searchNotes(notes, "istanbul #seyahat");
    assert.equal(res2.length, 1);
    assert.equal(res2[0].note.title, "İstanbul Gezi Planı");

    const resTodo = searchNotes(notes, "is:todo");
    assert.equal(resTodo.length, 1);
    assert.equal(resTodo[0].note.title, "Alışveriş Listesi");
  });

  it("produces clean highlight segments", () => {
    const segs = getHighlightSegments("Alışveriş Listesi", ["alisveris"]);
    assert.equal(segs[0].highlight, true);
    assert.equal(segs[0].text, "Alışveriş");
  });
});

describe("Turso / libSQL + FTS5 Database Engine", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notiq-db-test-"));
  const dbFile = path.join(tmpDir, "test.db");

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates, searches via FTS5, prepends, touches, and syncs notes", async () => {
    process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
    const db = await import("../src/lib/db");

    const created = await db.createNote({
      title: "Hızlı Alışveriş",
      content: "- [ ] Kahve çekirdeği #ev",
      color: "amber",
    });
    assert.equal(created.title, "Hızlı Alışveriş");
    assert.deepEqual(created.tags, ["ev"]);

    const updated = await db.updateNote(created.id, {
      prependText: "Ekmek al",
      prependAsChecklist: true,
    });
    assert.ok(updated);
    assert.equal(updated.content, "- [ ] Ekmek al\n- [ ] Kahve çekirdeği #ev");

    const touched = await db.touchNote(created.id, { openDelta: 3, focusMsDelta: 5000 });
    assert.ok(touched);
    assert.equal(touched.openCount, created.openCount + 3);
    assert.equal(touched.totalFocusMs, 5000);

    const ftsResults = await db.listNotes({ query: "Ekmek" });
    assert.equal(ftsResults.length, 1);
    assert.equal(ftsResults[0].id, created.id);

    const syncRes = await db.syncNotesBatch([
      makeNote({
        id: "remote-sync-1",
        title: "Telefondan Gelen Not",
        content: "Çevrimdışı yazıldı #mobil",
        tags: ["mobil"],
      }),
    ]);
    assert.ok(syncRes.notes.some((n) => n.id === "remote-sync-1"));
    assert.ok(syncRes.notes.some((n) => n.id === created.id));
  });
});
