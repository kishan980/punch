import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    // 1. Verify that requesting user is an Admin
    const isAdminEmail = Boolean(
      user.email?.toLowerCase().includes("admin") ||
      user.email?.toLowerCase().includes("owner") ||
      user.email?.toLowerCase().includes("manager")
    );

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    const isAuthorized = isAdminEmail || adminProfile?.role === "admin";
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    // 2. Extract memberId to delete
    const url = new URL(request.url);
    let memberId = url.searchParams.get("memberId");

    if (!memberId) {
      const body = await request.json().catch(() => ({}));
      memberId = body.memberId;
    }

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required to delete a member." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 3. Find the member to be deleted
    const { data: targetProfile, error: findError } = await adminClient
      .from("profiles")
      .select("id, auth_user_id, full_name, member_code, role")
      .eq("id", memberId)
      .single();

    if (findError || !targetProfile) {
      return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
    }

    // Prevent deleting oneself
    if (targetProfile.auth_user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own admin account from here." },
        { status: 400 }
      );
    }

    // 4. Cascade delete: Attendance records
    await adminClient
      .from("attendance")
      .delete()
      .or(`member_id.eq.${targetProfile.id},user_id.eq.${targetProfile.auth_user_id}`);

    // 5. Cascade delete: Biometric passkey credentials
    if (targetProfile.auth_user_id) {
      await adminClient
        .from("webauthn_credentials")
        .delete()
        .eq("user_id", targetProfile.auth_user_id);
    }

    // 6. Delete member profile
    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", targetProfile.id);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileDeleteError.message}` },
        { status: 500 }
      );
    }

    // 7. Delete auth user from Supabase Auth
    if (targetProfile.auth_user_id) {
      try {
        await adminClient.auth.admin.deleteUser(targetProfile.auth_user_id);
      } catch (authErr) {
        console.error("Error deleting auth user:", authErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Member ${targetProfile.full_name} (${targetProfile.member_code}) deleted successfully.`,
      deletedMemberId: targetProfile.id,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error: ${err.message}` },
      { status: 500 }
    );
  }
}
