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

    const supabaseAdmin = createAdminClient();

    // 1. Create user with email_confirm: true
    // This auto-confirms the email immediately without sending any verification email!
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName?.trim() || email.split("@")[0],
        },
      });

    if (createError) {
      // If user already exists, give clear feedback
      if (
        createError.message?.includes("already registered") ||
        createError.message?.includes("already been registered")
      ) {
        return NextResponse.json(
          { error: "This email is already registered. Please sign in directly." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!userData.user) {
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

    await supabaseAdmin.from("profiles").upsert(
      {
        auth_user_id: userData.user.id,
        full_name: fullName?.trim() || email.split("@")[0],
        member_code: defaultCode,
        role: isAdmin ? "admin" : "member",
        status: "active",
      },
      { onConflict: "auth_user_id" }
    );

    return NextResponse.json({
      success: true,
      message: "Account created and auto-confirmed! Logging in...",
      user: userData.user,
    });
  } catch (error: unknown) {
    console.error("Signup API error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
