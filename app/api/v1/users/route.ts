import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

export async function POST(req: NextRequest) {
  noStore();

  try {
    const body = await req.json();
    const { email, phone, firstName, lastName, role }: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400 },
      );
    }

    const allowedRoles = ["admin", "shadchan", "user"];
    const safeRole = allowedRoles.includes(role ?? "") ? role : "user";

    // Verify the requesting user is authenticated and is an admin
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = currentUser.user_metadata?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        role: safeRole,
      },
    });

    if (error || !data.user) {
      console.error("Error creating user:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to create user" },
        { status: 500 },
      );
    }

    const user = data.user;

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        firstName: user.user_metadata?.firstName ?? null,
        lastName: user.user_metadata?.lastName ?? null,
        role: user.user_metadata?.role ?? "user",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error creating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

