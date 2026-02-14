import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { side } = await req.json();
    if (!id || !side || !["gto", "exploit"].includes(side)) {
      return NextResponse.json(
        { error: "Invalid id or side" },
        { status: 400 }
      );
    }

    const col = side === "gto" ? "votes_gto" : "votes_exploit";
    const { data: row, error: fetchErr } = await supabase
      .from("arena_debates")
      .select("votes_gto, votes_exploit")
      .eq("id", id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    const currentVal = Number(row[col as "votes_gto" | "votes_exploit"]) || 0;
    const newVal = currentVal + 1;
    const { error: updateErr } = await supabase
      .from("arena_debates")
      .update({ [col]: newVal })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, [col]: newVal });
  } catch (e) {
    console.error("vote error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
