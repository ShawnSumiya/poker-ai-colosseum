import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ビルド時に .env.local が未読み込みの場合のフォールバック（本番では .env.local の値を使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type ArenaDebateRow = Database["public"]["Tables"]["arena_debates"]["Row"];
export type ArenaDebateInsert = Database["public"]["Tables"]["arena_debates"]["Insert"];
