"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CARD_PATTERN = /\b(10|[AKQJT2-9])[shdc]\b/gi;

const suitColors: Record<string, string> = {
  s: "text-slate-300",
  h: "text-red-400",
  d: "text-blue-400",
  c: "text-emerald-400",
};

function CardBadgeInner({ card }: { card: string }) {
  const rank = card.slice(0, -1).toUpperCase();
  const suit = card.slice(-1).toLowerCase();
  const suitChar = { s: "♠", h: "♥", d: "♦", c: "♣" }[suit] || "";

  return (
    <Badge
      variant="card"
      className={cn(
        "inline-flex min-w-[2.25rem] justify-center py-0.5 font-mono text-sm",
        suitColors[suit] || "text-white"
      )}
    >
      {rank}
      <span className="ml-0.5 opacity-80">{suitChar}</span>
    </Badge>
  );
}

/** テキスト内のカード表記（Ah, Kd, Ts等）をカード型バッジに変換 */
export function renderTextWithCardBadges(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  const regex = new RegExp(CARD_PATTERN.source, "gi");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${keyIndex++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    parts.push(
      <CardBadgeInner key={`c-${keyIndex++}-${match[0]}`} card={match[0]} />
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${keyIndex++}`}>{text.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : [text];
}
