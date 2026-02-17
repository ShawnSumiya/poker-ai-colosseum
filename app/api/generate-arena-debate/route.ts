import { NextResponse } from "next/server";
import {
  generateDebate,
  generateRandomScenario,
  continueDebate,
  type PokerScenario,
} from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** サイコロを振る: 1〜100の乱数で、閾値以下なら「投稿する」とみなす。80%でほぼ毎回投稿（GitHub Actions 無料枠のラグを考慮） */
const POST_PROBABILITY = 80;

/** durationMode に応じた寿命（ターン数）を決定。新規作成時に1回だけ呼び、結果を transcript_json.maxTurns に保存する */
function getMaxTurnsForMode(mode: "Short" | "Medium" | "Long"): number {
  switch (mode) {
    case "Short":
      return Math.floor(Math.random() * (15 - 8 + 1)) + 8; // 8〜15ターン（サクッと終わる）
    case "Medium":
      return Math.floor(Math.random() * (50 - 30 + 1)) + 30; // 30〜50ターン（そこそこ続く）
    case "Long":
      return Math.floor(Math.random() * (120 - 80 + 1)) + 80; // 80〜120ターン（泥沼化）
    default:
      return Math.floor(Math.random() * (50 - 30 + 1)) + 30;
  }
}

/** レガシー用: durationMode から決定的な maxTurns を返す（既に保存されていない古い議論用） */
function getMaxTurnsFallback(mode: "Short" | "Medium" | "Long"): number {
  switch (mode) {
    case "Short":
      return 15;
    case "Medium":
      return 50;
    case "Long":
      return 120;
    default:
      return 50;
  }
}

function rollDice(): boolean {
  const roll = Math.floor(Math.random() * 100) + 1;
  return roll <= POST_PROBABILITY;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!rollDice()) {
    console.log("Skipped: Not in the mood to post (dice roll).");
    return NextResponse.json({ skipped: true, message: "AI is sleeping or busy." });
  }

  return executeDebateLogic();
}

/** POST は手動ボタン用なので、サイコロは使わず必ず実行 */
export async function POST() {
  return executeDebateLogic();
}

async function executeDebateLogic() {
  try {
    // 1. 最新の議論を取得する
    const { data: latestDebates } = await supabase
      .from("arena_debates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    const latestDebate = latestDebates?.[0] ?? null;

    // 2. 既存の議論があり、寿命未満の場合 → 「続き」を書く
    if (latestDebate) {
      const transcriptJson = latestDebate.transcript_json as {
        transcript?: { speaker?: unknown; content?: string }[];
        title?: string;
        scenario?: unknown;
        maxTurns?: number;
      } | null;
      const currentTranscript = transcriptJson?.transcript ?? [];
      const scenario = (latestDebate.scenario_json ?? transcriptJson?.scenario) as PokerScenario | null;

      // durationMode から寿命（maxTurns）を決定。既に保存されていればそれを使う（レガシーはフォールバック）
      const mode = scenario?.durationMode ?? "Medium";
      const maxTurns = transcriptJson?.maxTurns ?? getMaxTurnsFallback(mode);

      if (Array.isArray(currentTranscript) && currentTranscript.length < maxTurns) {
        console.log(`Continuing debate ID: ${latestDebate.id} (Mode: ${mode}, Current: ${currentTranscript.length}/${maxTurns})`);

        const newLines = await continueDebate(currentTranscript, scenario ?? ({} as PokerScenario));

        if (newLines && newLines.length > 0) {
          const updatedTranscript = [...currentTranscript, ...newLines];

          const { error } = await supabase
            .from("arena_debates")
            .update({
              transcript_json: {
                ...transcriptJson,
                transcript: updatedTranscript,
                maxTurns: transcriptJson?.maxTurns ?? maxTurns, // レガシーならここで保存
              } as unknown as Json,
            })
            .eq("id", latestDebate.id);

          if (error) throw error;
          return NextResponse.json({
            success: true,
            mode: "continued",
            turns: updatedTranscript.length,
            maxTurns,
            durationMode: mode,
          });
        }
      } else {
        console.log(`Debate ID: ${latestDebate.id} finished (Mode: ${mode}, Reached ${maxTurns} turns). Starting new one.`);
      }
    }

    // 3. 議論がない、または寿命に達している場合 → 「新規作成」する
    console.log("Starting NEW debate...");

    const { data: allDebates } = await supabase
      .from("arena_debates")
      .select("votes_gto, votes_exploit");
    const totalGto = allDebates?.reduce((s, r) => s + (r.votes_gto ?? 0), 0) ?? 0;
    const totalExploit = allDebates?.reduce((s, r) => s + (r.votes_exploit ?? 0), 0) ?? 0;
    const grandTotal = totalGto + totalExploit || 1;
    const gtoPercentage = Math.round((totalGto / grandTotal) * 100);
    const exploitPercentage = 100 - gtoPercentage;

    const scenario = generateRandomScenario();
    const generatedData = await generateDebate(scenario, {
      gtoPercentage,
      exploitPercentage,
    });

    const mode = scenario.durationMode ?? "Medium";
    const maxTurns = getMaxTurnsForMode(mode);

    const initialGtoVotes = generatedData.winner === "gto" ? 1 : 0;
    const initialExploitVotes = generatedData.winner === "exploit" ? 1 : 0;

    const { data, error } = await supabase
      .from("arena_debates")
      .insert({
        title: generatedData.title,
        scenario_json: (scenario ?? generatedData.scenario) as unknown as Json,
        transcript_json: {
          title: generatedData.title,
          scenario: generatedData.scenario ?? scenario,
          transcript: generatedData.transcript,
          maxTurns,
        } as unknown as Json,
        votes_gto: initialGtoVotes,
        votes_exploit: initialExploitVotes,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      mode: "created",
      id: data?.id,
      title: generatedData.title,
      winner: generatedData.winner,
      durationMode: mode,
      maxTurns,
    });
  } catch (e) {
    console.error("generate-arena-debate error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
