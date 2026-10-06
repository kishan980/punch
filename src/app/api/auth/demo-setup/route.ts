import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabaseAdmin = createAdminClient();

    // 1. Create or ensure Demo Member User
    const memberEmail = "member@gympunch.local";
    const memberPassword = "member123456";

    let memberAuthUserId: string | null = null;
    const { data: memberUser, error: memberCreateErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: memberEmail,
        password: memberPassword,
        email_confirm: true,
      });

    if (memberUser?.user) {
      memberAuthUserId = memberUser.user.id;
    } else if (memberCreateErr) {
      // If user already exists, find user ID
      const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
      const existing = usersList?.users.find((u) => u.email === memberEmail);
      if (existing) {
        memberAuthUserId = existing.id;
        // Reset password to member123456 to ensure login works
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: memberPassword,
          email_confirm: true,
        });
      }
    }

    if (memberAuthUserId) {
      await supabaseAdmin.from("profiles").upsert(
        {
          auth_user_id: memberAuthUserId,
          full_name: "Kishan Yadav",
          member_code: "GYM-0001",
          phone: "+91 9811122233",
          role: "member",
          status: "active",
        },
        { onConflict: "auth_user_id" }
      );
    }

    // 2. Create or ensure Demo Admin User
    const adminEmail = "admin@gympunch.local";
    const adminPassword = "admin123456";

    let adminAuthUserId: string | null = null;
    const { data: adminUser, error: adminCreateErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

    if (adminUser?.user) {
      adminAuthUserId = adminUser.user.id;
    } else if (adminCreateErr) {
      const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
      const existing = usersList?.users.find((u) => u.email === adminEmail);
      if (existing) {
        adminAuthUserId = existing.id;
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: adminPassword,
          email_confirm: true,
        });
      }
    }

    if (adminAuthUserId) {
      await supabaseAdmin.from("profiles").upsert(
        {
          auth_user_id: adminAuthUserId,
          full_name: "Gym Manager",
          member_code: "ADM-001",
          phone: "+91 9876543210",
          role: "admin",
          status: "active",
        },
        { onConflict: "auth_user_id" }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Demo member and admin accounts initialized successfully!",
    });
  } catch (error: unknown) {
    console.error("Demo setup error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
