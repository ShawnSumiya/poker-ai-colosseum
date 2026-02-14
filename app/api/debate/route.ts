import { NextResponse } from "next/server";
import { generateDebate } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/supabase";
import type { PokerScenario } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { scenario } = await req.json();
    if (!scenario) {
      return NextResponse.json(
        { error: "scenario is required" },
        { status: 400 }
      );
    }

    const pokerScenario = scenario as PokerScenario;
    const transcript = await generateDebate(pokerScenario);

    const insertRow = {
      input_scenario: pokerScenario as Json,
      transcript_json: transcript as unknown as Json,
      user_id: null,
    };

    const { data, error } = await supabase
      .from("lab_analyses")
      .insert(insertRow)
      .select("id, created_at")
      .single();

    if (error) {
      console.error("lab_analyses insert error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save analysis" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcript,
      id: data?.id,
      created_at: data?.created_at,
    });
  } catch (e) {
    console.error("debate API error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
