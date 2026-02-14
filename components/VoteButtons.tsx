"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface VoteButtonsProps {
  debateId: string;
  votesGto: number;
  votesExploit: number;
  onVoted?: () => void;
}

export function VoteButtons({
  debateId,
  votesGto: initialVotesGto,
  votesExploit: initialVotesExploit,
  onVoted,
}: VoteButtonsProps) {
  const [voted, setVoted] = useState<"gto" | "exploit" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 楽観的UI: 投票後に即時反映
  const [votesGto, setVotesGto] = useState(initialVotesGto);
  const [votesExploit, setVotesExploit] = useState(initialVotesExploit);

  useEffect(() => {
    setVotesGto(initialVotesGto);
    setVotesExploit(initialVotesExploit);
  }, [initialVotesGto, initialVotesExploit]);

  const total = votesGto + votesExploit;
  const gtoPct = total > 0 ? Math.round((votesGto / total) * 100) : 50;
  const exploitPct = total > 0 ? Math.round((votesExploit / total) * 100) : 50;

  async function vote(side: "gto" | "exploit") {
    if (voted || loading) return;
    setLoading(true);
    setError(null);

    // 楽観的UI更新: 先に表示を更新
    setVoted(side);
    if (side === "gto") {
      setVotesGto((v) => v + 1);
    } else {
      setVotesExploit((v) => v + 1);
    }

    try {
      const { error: rpcError } = await supabase.rpc("increment_vote", {
        row_id: debateId,
        vote_side: side,
      });

      if (rpcError) {
        setError(rpcError.message);
        // 楽観的更新をロールバック
        setVoted(null);
        if (side === "gto") {
          setVotesGto((v) => v - 1);
        } else {
          setVotesExploit((v) => v - 1);
        }
      } else {
        onVoted?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票に失敗しました");
      setVoted(null);
      if (side === "gto") {
        setVotesGto((v) => v - 1);
      } else {
        setVotesExploit((v) => v - 1);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => vote("gto")}
          disabled={!!voted || loading}
          className={
            voted === "gto"
              ? "border-blue-500 bg-blue-500/20 text-blue-300"
              : "hover:border-blue-500/50"
          }
        >
          <Brain className="mr-1.5 h-4 w-4" />
          GTO派
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => vote("exploit")}
          disabled={!!voted || loading}
          className={
            voted === "exploit"
              ? "border-red-500 bg-red-500/20 text-red-300"
              : "hover:border-red-500/50"
          }
        >
          <Flame className="mr-1.5 h-4 w-4" />
          Exploit派
        </Button>
      </div>
      <div className="flex gap-2">
        <div
          className="flex flex-1 overflow-hidden rounded-full bg-muted"
          style={{ display: "flex" }}
        >
          <div
            className="h-2 bg-blue-500/70 transition-all"
            style={{ width: `${gtoPct}%` }}
          />
          <div
            className="h-2 bg-red-500/70 transition-all"
            style={{ width: `${exploitPct}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
          {votesGto} / {votesExploit}
        </span>
      </div>
    </div>
  );
}
