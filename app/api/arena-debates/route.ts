import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// キャッシュ完全無効化
export const dynamic = "force-dynamic";
export const revalidate = 0; // 0秒で再検証＝常に最新
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("arena_debates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { debates: data || [] },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (e) {
    console.error("arena-debates GET error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
