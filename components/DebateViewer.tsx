"use client";

import { Fragment } from "react";
import { User, Cpu } from "lucide-react";
import { renderTextWithCardBadges } from "./CardBadge";
import { cn } from "@/lib/utils";
import type { DebateTurn } from "@/lib/types";

/** チャット風の時間表示用（例: "2/17 16:45"） */
const formatMessageTime = (isoString: string) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
function normalizeTurn(
  turn: DebateTurn | { role?: string; speaker?: string; content: string; timestamp?: string }
): DebateTurn {
  const speaker = (turn as DebateTurn).speaker ?? (turn as { role?: string }).role ?? "dealer";
  return {
    speaker: speaker as "gto" | "exploit" | "dealer",
    content: turn.content,
    ...(turn.timestamp != null && { timestamp: turn.timestamp }),
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
              <div key={i} className="flex flex-col items-center mb-4">
                <div className="bg-slate-800/80 text-slate-400 text-sm px-4 py-2 rounded-full border border-slate-700 shadow-sm max-w-[90%] text-center">
                  {formatText(turn.content, "dealer")}
                </div>
                {turn.timestamp && (
                  <span className="text-[10px] text-gray-500 mt-1 text-center">
                    {formatMessageTime(turn.timestamp)}
                  </span>
                )}
              </div>
            );
          }

          // GTO: 左（青） / Exploit: 右（赤）
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col w-full mb-4",
                isGto ? "items-start" : "items-end"
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
              {/* チャット風の時間表示 */}
              {turn.timestamp && (
                <span
                  className={cn(
                    "text-[10px] text-gray-500 mt-1",
                    isGto ? "text-left ml-12" : "text-right mr-12"
                  )}
                >
                  {formatMessageTime(turn.timestamp)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
