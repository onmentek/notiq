"use client";

import { getHighlightSegments } from "@/lib/search";

interface HighlightTextProps {
  text: string;
  terms?: string[];
  className?: string;
}

export function HighlightText({ text, terms = [], className }: HighlightTextProps) {
  if (!terms.length) {
    return <span className={className}>{text}</span>;
  }

  const segments = getHighlightSegments(text, terms);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="rounded-sm bg-blue-500/20 px-0.5 text-blue-700 dark:bg-blue-400/25 dark:text-blue-200"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
