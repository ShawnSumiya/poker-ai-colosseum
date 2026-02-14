import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

/** App Router の Server Component / Route Handler 用の Supabase クライアント */
export function createClient() {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);
}
