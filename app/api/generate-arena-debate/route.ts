import { NextResponse } from "next/server";
import { generateDebate, generateRandomScenario } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** サイコロを振る: 1〜100の乱数で、閾値以下なら「投稿する」とみなす */
const POST_PROBABILITY = 30; // 15% → 平均 1.5〜2時間に1回程度

function rollDice(): boolean {
  const roll = Math.floor(Math.random() * 100) + 1; // 1〜100
  return roll <= POST_PROBABILITY;
}

export async function GET(request: Request) {
  // セキュリティ: Vercel Cron 以外からのアクセスを弾く（開発中はコメントアウト可）
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return new NextResponse("Unauthorized", { status: 401 });
  }

  // 人間っぽさの演出: サイコロを振って「気分」判定
  if (!rollDice()) {
    console.log("Skipped: Not in the mood to post (dice roll).");
    return NextResponse.json({ skipped: true, message: "AI is sleeping or busy." });
  }

  return executeDebateGeneration();
}

/** POST は手動ボタン用なので、サイコロは使わず必ず実行 */
export async function POST() {
  return executeDebateGeneration();
}

async function executeDebateGeneration() {
  try {
    // 1. 既存票集計（バランス用）
    const { data: voteTotals } = await supabase
      .from("arena_debates")
      .select("votes_gto, votes_exploit");
    const totalGto = voteTotals?.reduce((s, r) => s + (r.votes_gto ?? 0), 0) ?? 0;
    const totalExploit = voteTotals?.reduce((s, r) => s + (r.votes_exploit ?? 0), 0) ?? 0;
    const totalVotes = totalGto + totalExploit;
    const gtoPercentage = totalVotes > 0 ? Math.round((totalGto / totalVotes) * 100) : 50;
    const exploitPercentage = totalVotes > 0 ? Math.round((totalExploit / totalVotes) * 100) : 50;

    // 2. 議論を生成
    const scenario = generateRandomScenario();
    const generatedData = await generateDebate(scenario, {
      gtoPercentage,
      exploitPercentage,
    });

    // AIの1票: winner に応じて初期票を設定（50:50問題対策）
    const initialGtoVotes = generatedData.winner === "gto" ? 1 : 0;
    const initialExploitVotes = generatedData.winner === "exploit" ? 1 : 0;

    // 3. DBに保存（初期票を入れた状態で）
    const { data, error } = await supabase
      .from("arena_debates")
      .insert({
        title: generatedData.title,
        scenario_json: (generatedData.scenario ?? scenario) as unknown as Json,
        transcript_json: {
          title: generatedData.title,
          scenario: generatedData.scenario ?? scenario,
          transcript: generatedData.transcript,
        } as unknown as Json,
        votes_gto: initialGtoVotes,
        votes_exploit: initialExploitVotes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save debate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data?.id, title: generatedData.title });
  } catch (e) {
    console.error("generate-arena-debate error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
