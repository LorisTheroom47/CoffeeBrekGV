import "server-only";

import { redirect } from "next/navigation";
import {
  getCurrentUser,
  type AuthenticatedUser,
} from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminAuthorization =
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "authorized"; user: AuthenticatedUser }>
  | Readonly<{ status: "unauthorized"; user: AuthenticatedUser }>
  | Readonly<{ status: "error"; user: AuthenticatedUser }>;

export async function getAdminAuthorization(): Promise<AdminAuthorization> {
  const user = await getCurrentUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Verifica autorizzazione amministratore non riuscita.");
      return { status: "error", user };
    }

    if (data?.user_id === user.id) {
      return { status: "authorized", user };
    }

    return { status: "unauthorized", user };
  } catch {
    console.error("Verifica autorizzazione amministratore non riuscita.");
    return { status: "error", user };
  }
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const authorization = await getAdminAuthorization();

  if (authorization.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (authorization.status !== "authorized") {
    redirect("/admin/unauthorized");
  }

  return authorization.user;
}
