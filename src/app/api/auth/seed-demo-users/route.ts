import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function seedUsers() {
  try {
    const supabaseAdmin = createAdminClient();

    // 1. List existing users to find admin & member
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });

    if (listError) {
      throw listError;
    }

    const existingUsers = usersData?.users || [];
    const existingAdmin = existingUsers.find(
      (u) => u.email?.toLowerCase() === "admin@gympunch.local"
    );
    const existingMember = existingUsers.find(
      (u) => u.email?.toLowerCase() === "member@gympunch.local"
    );

    let adminId: string;
    if (existingAdmin) {
      adminId = existingAdmin.id;
      // Ensure password and email confirmed
      await supabaseAdmin.auth.admin.updateUserById(adminId, {
        password: "Admin@123456",
        email_confirm: true,
        user_metadata: { full_name: "Gym Administrator" },
      });
    } else {
      const { data: newAdmin, error: createAdminErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: "admin@gympunch.local",
          password: "Admin@123456",
          email_confirm: true,
          user_metadata: { full_name: "Gym Administrator" },
        });
      if (createAdminErr) throw createAdminErr;
      adminId = newAdmin.user.id;
    }

    // Provision Admin Profile
    await supabaseAdmin.from("profiles").upsert(
      {
        auth_user_id: adminId,
        full_name: "Gym Administrator",
        member_code: "ADM-001",
        role: "admin",
        status: "active",
        phone: "+91 98765 43210",
      },
      { onConflict: "auth_user_id" }
    );

    let memberId: string;
    if (existingMember) {
      memberId = existingMember.id;
      await supabaseAdmin.auth.admin.updateUserById(memberId, {
        password: "Member@123456",
        email_confirm: true,
        user_metadata: { full_name: "Kishan Yadav" },
      });
    } else {
      const { data: newMember, error: createMemberErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: "member@gympunch.local",
          password: "Member@123456",
          email_confirm: true,
          user_metadata: { full_name: "Kishan Yadav" },
        });
      if (createMemberErr) throw createMemberErr;
      memberId = newMember.user.id;
    }

    // Provision Member Profile
    await supabaseAdmin.from("profiles").upsert(
      {
        auth_user_id: memberId,
        full_name: "Kishan Yadav",
        member_code: "GYM-1001",
        role: "member",
        status: "active",
        phone: "+91 98765 12345",
      },
      { onConflict: "auth_user_id" }
    );

    return {
      admin: { email: "admin@gympunch.local", id: adminId },
      member: { email: "member@gympunch.local", id: memberId },
    };
  } catch (err) {
    // Fallback: If service role is not configured or rejected, use client-level signup
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: adminSignUp } = await supabase.auth.signUp({
      email: "admin@gympunch.local",
      password: "Admin@123456",
      options: { data: { full_name: "Gym Administrator" } },
    });

    const { data: memberSignUp } = await supabase.auth.signUp({
      email: "member@gympunch.local",
      password: "Member@123456",
      options: { data: { full_name: "Kishan Yadav" } },
    });

    return {
      admin: { email: "admin@gympunch.local", id: adminSignUp?.user?.id || "admin" },
      member: { email: "member@gympunch.local", id: memberSignUp?.user?.id || "member" },
      notice: "Provisioned via standard auth signup fallback",
    };
  }
}

export async function POST() {
  try {
    const result = await seedUsers();
    return NextResponse.json({
      success: true,
      message: "Admin and Member accounts initialized successfully!",
      accounts: result,
    });
  } catch (error: unknown) {
    console.error("Seed users error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await seedUsers();
    return NextResponse.json({
      success: true,
      message: "Admin and Member accounts initialized successfully!",
      accounts: result,
    });
  } catch (error: unknown) {
    console.error("Seed users error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
