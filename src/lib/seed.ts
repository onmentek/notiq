import { extractTags } from "./frecency";
import type { Note } from "./types";

export function createStarterNotes(): Note[] {
  const now = Date.now();
  const min = 60_000;

  const drafts: Array<{
    title: string;
    content: string;
    color: Note["color"];
    isPinned: boolean;
    openCount: number;
    editCount: number;
    ageMin: number;
  }> = [
    {
      title: "Hızlı Başlangıç & Kısayollar",
      content: [
        "- [ ] Herhangi bir karta tıkla — üstten hemen yazmaya başla",
        "- [ ] Kart açıkken ← / → ile kartlar arasında anında geçiş yap",
        "- [ ] Masaüstünde Space ile yarı saydam Hızlı Bakış aç",
        "- [ ] ⌘K veya / ile anında ara, #etiket veya is:todo ile filtrele",
        "",
        "Sık açtığın ve düzenlediğin kartlar Akıllı Sıralama sayesinde otomatik olarak üst sıraya yükselir. #rehber #verimlilik",
      ].join("\n"),
      color: "sky",
      isPinned: true,
      openCount: 6,
      editCount: 3,
      ageMin: 2,
    },
    {
      title: "Günlük Hızlı Akış",
      content: [
        "14:20 — Kartı açtığın anda üstteki alana yazıp Enter'a basarsan yeni satır en üste eklenir.",
        "11:05 — Turso & Vercel senkronizasyonu aktif olduğunda telefon ve web anlık eşleşir.",
        "- [ ] Akşam yürüyüşü",
        "- [x] Sabah kahvesi ve gün planı",
        "#günlük #akış",
      ].join("\n"),
      color: "amber",
      isPinned: false,
      openCount: 5,
      editCount: 4,
      ageMin: 18,
    },
    {
      title: "Alışveriş & İhtiyaçlar",
      content: [
        "- [ ] Filtre kahve çekirdeği",
        "- [ ] Zeytinyağı & avokado",
        "- [ ] USB-C örgülü kablo",
        "- [x] Defter & ince uçlu kalem",
        "#alışveriş #ev",
      ].join("\n"),
      color: "sage",
      isPinned: false,
      openCount: 4,
      editCount: 2,
      ageMin: 95,
    },
    {
      title: "Proje Fikirleri",
      content: [
        "Yarı saydam katmanlarla odak kaybı yaşamadan tek ekranda bilgiye ulaşmak.",
        "Kart üstünde doğrudan görev işaretleme ve anlık geri alma.",
        "#fikir #tasarım",
      ].join("\n"),
      color: "lavender",
      isPinned: false,
      openCount: 2,
      editCount: 1,
      ageMin: 240,
    },
  ];

  return drafts.map((d) => {
    const ts = now - d.ageMin * min;
    return {
      id: crypto.randomUUID(),
      title: d.title,
      content: d.content,
      color: d.color,
      tags: extractTags(d.title, d.content),
      isPinned: d.isPinned,
      isArchived: false,
      openCount: d.openCount,
      editCount: d.editCount,
      totalFocusMs: d.openCount * 8_000,
      lastOpenedAt: ts,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  });
}
