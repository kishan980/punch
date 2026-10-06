import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_SUPABASE_URL = "https://vfswlbvjcpyzepiipmww.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmc3dsYnZqY3B5emVwaWlwbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzUwMDAsImV4cCI6MjEwNjg1MTAwMH0.NK7PRsdhaRTmIkMjhj-b_hKPc627NfsAOknp9944U5I";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
