import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    let userObj = null;

    try {
      const supabaseAdmin = createAdminClient();
      const { data: userData, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName?.trim() || email.split("@")[0],
          },
        });

      if (!createError && userData?.user) {
        userId = userData.user.id;
        userObj = userData.user;
      } else if (createError) {
        if (
          createError.message?.includes("already registered") ||
          createError.message?.includes("already been registered")
        ) {
          return NextResponse.json(
            { error: "This email is already registered. Please sign in directly." },
            { status: 400 }
          );
        }
        throw createError;
      }
    } catch {
      // Fallback: Use standard signup
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: suData, error: suErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName?.trim() || email.split("@")[0],
          },
        },
      });

      if (suErr) {
        if (
          suErr.message?.includes("already registered") ||
          suErr.message?.includes("already been registered")
        ) {
          return NextResponse.json(
            { error: "This email is already registered. Please sign in directly." },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: suErr.message }, { status: 400 });
      }

      if (suData?.user) {
        userId = suData.user.id;
        userObj = suData.user;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create user account." },
        { status: 500 }
      );
    }

    // 2. Provision their profile in public.profiles table
    const isAdmin = email.toLowerCase().includes("admin");
    const defaultCode = isAdmin
      ? `ADM-${Math.floor(100 + Math.random() * 900)}`
      : `GYM-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("profiles").upsert(
        {
          auth_user_id: userId,
          full_name: fullName?.trim() || email.split("@")[0],
          member_code: defaultCode,
          role: isAdmin ? "admin" : "member",
          status: "active",
        },
        { onConflict: "auth_user_id" }
      );
    } catch {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        await supabase.from("profiles").upsert(
          {
            auth_user_id: userId,
            full_name: fullName?.trim() || email.split("@")[0],
            member_code: defaultCode,
            role: isAdmin ? "admin" : "member",
            status: "active",
          },
          { onConflict: "auth_user_id" }
        );
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "Account created and auto-confirmed! Logging in...",
      user: userObj,
    });
  } catch (error: unknown) {
    console.error("Signup API error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
