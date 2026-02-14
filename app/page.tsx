"use client";

import { useCallback, useEffect, useState } from "react";
import { DebateViewer } from "@/components/DebateViewer";
import { VoteButtons } from "@/components/VoteButtons";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { Swords, ChevronDown, ChevronUp, MessageSquare, AlertCircle } from "lucide-react";

type ArenaDebateRow = Database["public"]["Tables"]["arena_debates"]["Row"];

// Strict Modeのremount後も、古いfetchのレスポンスを無視するためモジュールレベルで共有
let fetchId = 0;

export default function ArenaPage() {
  const [debates, setDebates] = useState<ArenaDebateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDebates = useCallback(async () => {
    const id = ++fetchId;
    try {
      setLoading(true);

      // URLの末尾に「現在時刻」をつけることで、ブラウザに「これは新しいリクエストだ！」と強制的に認識させる
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/arena-debates?ts=${timestamp}`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });

      const data = await res.json();

      if (id !== fetchId) return;
      if (data?.error) {
        console.error("API error:", data.error);
        setDebates([]);
        return;
      }
      if (data && Array.isArray(data.debates)) {
        setDebates(data.debates);
      } else {
        setDebates([]);
      }
    } catch (error) {
      if (id !== fetchId) return;
      console.error("Failed to fetch debates:", error);
    } finally {
      if (id === fetchId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebates();
  }, []);

  // タブに戻った時・ウィンドウがフォーカスされた時に再取得
  useEffect(() => {
    const onFocus = () => fetchDebates();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchDebates]);

  const generateNewDebate = async () => {
    const btn = document.getElementById("generate-btn") as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Generating...";
    }
    try {
      await fetch("/api/generate-arena-debate", { method: "POST" });
      await fetchDebates();
    } catch (e) {
      alert("Failed to generate debate");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Generate Battle";
      }
    }
  };

  const toggleDebate = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent flex items-center gap-2">
              <Swords className="w-8 h-8 text-slate-100" />
              Poker AI Colosseum
            </h1>
          </div>
          <div className="flex gap-3">
             <Link href="/lab" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-sm font-medium border border-slate-700">
              Go to Lab
            </Link>
            <button
              id="generate-btn"
              onClick={generateNewDebate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition text-sm font-bold shadow-lg shadow-indigo-900/20"
            >
              Generate Battle
            </button>
          </div>
        </header>

        {/* Debates List */}
        <main className="space-y-4">
          {loading && <div className="text-center py-10 text-slate-500">Loading arena...</div>}

          {!loading && debates.length === 0 && (
             <div className="text-center py-10 text-slate-500">No battles found. Generate one!</div>
          )}

          {debates.map((debate) => {
            // ★防御的コーディング: データがnullや変な形式でも壊れないようにする
            const transcriptData = (debate.transcript_json as any) || {};
            const scenarioData = (debate.scenario_json as any) || {};
            
            // 安全にデータを取り出す
            const transcript = Array.isArray(transcriptData.transcript) ? transcriptData.transcript : [];
            const title = transcriptData.title || debate.title || "Unknown Scenario";
            const isExpanded = expandedId === debate.id;
            const totalVotes = (debate.votes_gto || 0) + (debate.votes_exploit || 0);
            const gtoPercent = totalVotes > 0 ? Math.round(((debate.votes_gto || 0) / totalVotes) * 100) : 50;
            const exploitPercent = 100 - gtoPercent;

            // もしデータが壊れていてタイトルすらない場合はスキップ（またはエラー表示）
            if (!title && transcript.length === 0) return null;

            return (
              <article 
                key={debate.id} 
                className={`bg-slate-900/40 rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'border-indigo-500/50 shadow-indigo-900/20 shadow-lg' : 'border-slate-800 hover:border-slate-700'}`}
              >
                <div 
                  onClick={() => toggleDebate(debate.id)}
                  className="p-5 cursor-pointer flex justify-between items-start gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
                        {scenarioData.gameType || "NLHE"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(debate.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="font-bold text-lg text-slate-100 leading-tight">
                      {title}
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} /> {transcript.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle size={14} /> {totalVotes} votes
                      </span>
                    </div>

                    {/* 現在の投票比率（優勢度）バー - 民意＋AI初期票 */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1 uppercase tracking-wider">
                        <span className={gtoPercent > exploitPercent ? "text-blue-400 font-bold" : ""}>
                          GTO {gtoPercent}%
                        </span>
                        <span className={exploitPercent > gtoPercent ? "text-red-400 font-bold" : ""}>
                          Exploit {exploitPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${gtoPercent}%` }}
                        />
                        <div
                          className="h-full bg-red-600 transition-all duration-500"
                          style={{ width: `${exploitPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-slate-500 pt-1 shrink-0">
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800/50 bg-slate-950/30">
                    <DebateViewer transcript={transcript} />
                    <div className="p-4 pt-0">
                      <VoteButtons 
                        debateId={debate.id} 
                        votesGto={debate.votes_gto || 0}
                        votesExploit={debate.votes_exploit || 0}
                        onVoted={fetchDebates}
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
