"use client";

import { Fragment } from "react";
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
const formatText = (text: string, _speaker: "gto" | "exploit" | "dealer" | "noob") => {
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
    speaker: speaker as "gto" | "exploit" | "dealer" | "noob",
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
          const isDealer = turn.speaker === "dealer";
          const isGto = turn.speaker === "gto";
          const isExploit = turn.speaker === "exploit";
          const isNoob = turn.speaker === "noob";

          return (
            <div
              key={i}
              className={cn(
                "flex flex-col mb-4",
                isDealer ? "items-center" : isGto ? "items-start" : isExploit ? "items-end" : "items-center"
              )}
            >
              <div
                className={cn(
                  "flex items-end gap-2",
                  isExploit ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* アイコン表示エリア */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isDealer && "bg-gray-700 text-white",
                    isGto && "bg-blue-600 text-white",
                    isExploit && "bg-red-600 text-white",
                    isNoob && "bg-green-500 text-white"
                  )}
                >
                  {isDealer ? "D" : isGto ? "GTO" : isExploit ? "EXP" : "NOOB"}
                </div>

                {/* フキダシ部分 */}
                <div
                  className={cn(
                    "p-3 rounded-lg max-w-[80%]",
                    isDealer && "bg-gray-800 text-gray-300 text-sm w-full text-center border border-gray-700",
                    isGto && "bg-blue-900/30 text-blue-100 border border-blue-800 rounded-tl-none",
                    isExploit && "bg-red-900/30 text-red-100 border border-red-800 rounded-tr-none",
                    isNoob && "bg-green-900/30 text-green-100 border border-green-800"
                  )}
                >
                  {/* 名前ラベル */}
                  {!isDealer && (
                    <div
                      className={cn(
                        "text-[10px] font-bold mb-1 opacity-70",
                        isExploit ? "text-right" : "text-left"
                      )}
                    >
                      {isGto ? "GTO BOT" : isExploit ? "EXPLOIT BOT" : "BEGINNER"}
                    </div>
                  )}

                  {/* 本文 */}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {formatText(turn.content, turn.speaker)}
                  </div>
                </div>
              </div>

              {/* タイムスタンプ */}
              {turn.timestamp && (
                <span
                  className={cn(
                    "text-[10px] text-gray-500 mt-1 mx-1",
                    isGto && "text-left ml-12",
                    isExploit && "text-right mr-12",
                    (isDealer || isNoob) && "text-center"
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
