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
      return NextResponse.json(
        { error: "Unauthorized: Please log in to delete your account." },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Fetch member profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("auth_user_id", user.id)
      .single();

    // Prevent admin from accidentally deleting the main admin account via member portal
    if (profile?.role === "admin" || user.email?.toLowerCase().includes("admin")) {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted from the member portal." },
        { status: 403 }
      );
    }

    const profileId = profile?.id;

    // 2. Cascade delete attendance logs
    if (profileId) {
      await adminClient
        .from("attendance")
        .delete()
        .or(`member_id.eq.${profileId},user_id.eq.${user.id}`);
    } else {
      await adminClient.from("attendance").delete().eq("user_id", user.id);
    }

    // 3. Cascade delete biometric passkey credentials
    await adminClient
      .from("webauthn_credentials")
      .delete()
      .eq("user_id", user.id);

    // 4. Delete profile
    if (profileId) {
      await adminClient.from("profiles").delete().eq("id", profileId);
    } else {
      await adminClient.from("profiles").delete().eq("auth_user_id", user.id);
    }

    // 5. Delete Supabase Auth User
    try {
      await adminClient.auth.admin.deleteUser(user.id);
    } catch (authErr) {
      console.error("Error deleting auth user:", authErr);
    }

    // 6. Sign out session
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Your member account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error: ${err.message}` },
      { status: 500 }
    );
  }
}
