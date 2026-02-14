"use client";

import { Fragment } from "react";
import { User, Cpu } from "lucide-react";
import { renderTextWithCardBadges } from "./CardBadge";
import { cn } from "@/lib/utils";
import type { DebateTurn } from "@/lib/types";

/** テキスト装飾関数（強化版）: \n → 改行、**text** → 太字、カード表記 → バッジ */
const formatText = (text: string, _speaker: "gto" | "exploit" | "dealer") => {
  if (!text) return null;

  // 0. リテラル \n を実際の改行に変換
  const normalized = text.replace(/\\n/g, "\n");

  // 1. 改行で分割してパラグラフを作る
  const lines = normalized.split("\n");

  return lines.map((line, lineIndex) => {
    if (line.trim() === "") return <div key={lineIndex} className="h-2" />;

    // 2. 太字記法 (**text**) をパース
    const parts = line.split(/(\*\*.*?\*\*)/g);

    const formattedLine = parts.map((part, partIndex) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const content = part.slice(2, -2);
        return (
          <span key={`bold-${lineIndex}-${partIndex}`} className="font-black text-lg text-slate-50 mx-1">
            {content}
          </span>
        );
      }
      return (
        <Fragment key={`txt-${lineIndex}-${partIndex}`}>
          {renderTextWithCardBadges(part)}
        </Fragment>
      );
    });

    return (
      <p key={lineIndex} className="min-h-[1.5em] leading-relaxed my-0.5">
        {formattedLine}
      </p>
    );
  });
};

/** 後方互換: role がある古いデータも speaker に正規化 */
function normalizeTurn(turn: DebateTurn | { role?: string; speaker?: string; content: string }): DebateTurn {
  const speaker = (turn as DebateTurn).speaker ?? (turn as { role?: string }).role ?? "dealer";
  return {
    speaker: speaker as "gto" | "exploit" | "dealer",
    content: turn.content,
  };
}

interface DebateViewerProps {
  transcript: (DebateTurn | { role?: string; speaker?: string; content: string })[];
  scenario?: Record<string, unknown>;
  className?: string;
}

export function DebateViewer({ transcript, scenario, className }: DebateViewerProps) {
  const turns = transcript.map(normalizeTurn);

  return (
    <div className={cn("space-y-4", className)}>
      {scenario && Object.keys(scenario).length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">状況:</span>{" "}
          {JSON.stringify(scenario)}
        </div>
      )}
      <div className="flex flex-col space-y-4 p-4 bg-slate-950/30 rounded-lg">
        {turns.map((turn, i) => {
          const isGto = turn.speaker === "gto";
          const isExploit = turn.speaker === "exploit";
          const isDealer = turn.speaker === "dealer";

          // Dealer（状況説明）は中央表示
          if (isDealer) {
            return (
              <div key={i} className="flex justify-center my-4">
                <div className="bg-slate-800/80 text-slate-400 text-sm px-4 py-2 rounded-full border border-slate-700 shadow-sm max-w-[90%] text-center">
                  {formatText(turn.content, "dealer")}
                </div>
              </div>
            );
          }

          // GTO: 左（青） / Exploit: 右（赤）
          return (
            <div
              key={i}
              className={cn(
                "flex w-full",
                isGto ? "justify-start" : "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-md relative group transition-all hover:scale-[1.01]",
                  isGto
                    ? "bg-slate-800 text-slate-100 rounded-tl-none border-l-4 border-blue-500"
                    : "bg-slate-800 text-slate-100 rounded-tr-none border-r-4 border-red-500"
                )}
              >
                {/* Speaker Label */}
                <div
                  className={cn(
                    "text-xs font-bold mb-1 flex items-center gap-1 uppercase tracking-wider",
                    isGto ? "text-blue-400" : "text-red-400 justify-end"
                  )}
                >
                  {isGto ? <Cpu size={14} /> : null}
                  {isGto ? "GTO Bot" : "Exploit Bot"}
                  {!isGto ? <User size={14} /> : null}
                </div>

                {/* Message Content */}
                <div className="text-sm md:text-base leading-relaxed text-slate-200">
                  {formatText(turn.content, turn.speaker)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
