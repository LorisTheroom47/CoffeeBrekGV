import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthenticatedUser = Readonly<{
  id: string;
}>;

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error || typeof userId !== "string" || userId.length === 0) {
      return null;
    }

    return { id: userId };
  } catch {
    return null;
  }
}
