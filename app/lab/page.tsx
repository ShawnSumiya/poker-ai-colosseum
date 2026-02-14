"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebateViewer } from "@/components/DebateViewer";
import { Beaker, Swords } from "lucide-react";
import type { DebateTurn } from "@/lib/types";

const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
const STACK_DEPTHS = ["20bb", "50bb", "100bb", "150bb", "200bb"];

export default function LabPage() {
  const [gameType, setGameType] = useState<"Cash" | "MTT">("Cash");
  const [stackDepth, setStackDepth] = useState("100bb");
  const [heroHand, setHeroHand] = useState("AsKh");
  const [board, setBoard] = useState("7d8d9s");
  const [heroPosition, setHeroPosition] = useState("BTN");
  const [villainPosition, setVillainPosition] = useState("BB");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<DebateTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFight() {
    setLoading(true);
    setError(null);
    setTranscript(null);
    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: {
            gameType,
            stackDepth,
            heroHand,
            board,
            heroPosition,
            villainPosition,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      setTranscript(data.transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">The Lab</h1>
        <p className="mt-1 text-muted-foreground">
          ハンド状況を入力して、GTO vs Exploit の議論を生成
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            状況入力
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Game Type
              </label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as "Cash" | "MTT")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="MTT">MTT</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Stack Depth
              </label>
              <select
                value={stackDepth}
                onChange={(e) => setStackDepth(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {STACK_DEPTHS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Hero Hand (例: AsKh)
              </label>
              <input
                type="text"
                value={heroHand}
                onChange={(e) => setHeroHand(e.target.value)}
                placeholder="AsKh"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Board (例: 7d8d9s)
              </label>
              <input
                type="text"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                placeholder="7d8d9s"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Hero Position
              </label>
              <select
                value={heroPosition}
                onChange={(e) => setHeroPosition(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Villain Position
              </label>
              <select
                value={villainPosition}
                onChange={(e) => setVillainPosition(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={handleFight}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              "議論生成中..."
            ) : (
              <>
                <Swords className="mr-2 h-4 w-4" />
                議論開始 (Fight!)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/50">
          <CardContent className="py-4 text-red-400">{error}</CardContent>
        </Card>
      )}

      {transcript && transcript.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>議論結果</CardTitle>
          </CardHeader>
          <CardContent>
            <DebateViewer
              transcript={transcript}
              scenario={{
                gameType,
                stackDepth,
                heroHand,
                board,
                heroPosition,
                villainPosition,
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
