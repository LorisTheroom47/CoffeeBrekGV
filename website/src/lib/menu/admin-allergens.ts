import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

export async function allAllergenIdsExist(
  supabase: ServerSupabaseClient,
  allergenIds: readonly string[],
) {
  if (allergenIds.length === 0) {
    return true;
  }

  const { data, error } = await supabase
    .from("allergens")
    .select("id")
    .in("id", [...allergenIds]);

  if (error) {
    throw error;
  }

  const existingIds = new Set((data ?? []).map(({ id }) => id));
  return allergenIds.every((id) => existingIds.has(id));
}

export async function readMenuItemAllergenIds(
  supabase: ServerSupabaseClient,
  menuItemId: string,
) {
  const { data, error } = await supabase
    .from("menu_item_allergens")
    .select("allergen_id")
    .eq("menu_item_id", menuItemId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(({ allergen_id }) => allergen_id);
}
