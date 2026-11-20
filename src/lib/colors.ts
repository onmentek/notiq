import type { NoteColor } from "./types";

export interface ColorMeta {
  id: NoteColor;
  label: string;
  dot: string;
  cardClass: string;
  modalGlow: string;
  accentBar: string;
}

export const NOTE_COLORS: ColorMeta[] = [
  {
    id: "default",
    label: "Nötr",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    cardClass: "note-tint-default",
    modalGlow: "from-indigo-500/8 via-transparent to-transparent",
    accentBar: "bg-zinc-400/50 dark:bg-zinc-500/50",
  },
  {
    id: "amber",
    label: "Kehribar",
    dot: "bg-amber-400",
    cardClass: "note-tint-amber",
    modalGlow: "from-amber-400/12 via-transparent to-transparent",
    accentBar: "bg-amber-400/80",
  },
  {
    id: "sage",
    label: "Adaçayı",
    dot: "bg-emerald-400",
    cardClass: "note-tint-sage",
    modalGlow: "from-emerald-400/12 via-transparent to-transparent",
    accentBar: "bg-emerald-400/80",
  },
  {
    id: "sky",
    label: "Gökyüzü",
    dot: "bg-sky-400",
    cardClass: "note-tint-sky",
    modalGlow: "from-sky-400/12 via-transparent to-transparent",
    accentBar: "bg-sky-400/80",
  },
  {
    id: "lavender",
    label: "Lavanta",
    dot: "bg-violet-400",
    cardClass: "note-tint-lavender",
    modalGlow: "from-violet-400/12 via-transparent to-transparent",
    accentBar: "bg-violet-400/80",
  },
  {
    id: "rose",
    label: "Gül",
    dot: "bg-rose-400",
    cardClass: "note-tint-rose",
    modalGlow: "from-rose-400/12 via-transparent to-transparent",
    accentBar: "bg-rose-400/80",
  },
];

export function getColorMeta(color: NoteColor): ColorMeta {
  return NOTE_COLORS.find((c) => c.id === color) ?? NOTE_COLORS[0];
}
