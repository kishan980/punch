import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile to determine role redirect
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  const isAdmin = user.email?.toLowerCase().includes("admin") || profile?.role === "admin";
  if (isAdmin) {
    redirect("/admin");
  }

  redirect("/member");
}
