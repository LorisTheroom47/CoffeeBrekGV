"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  getMenuItemExtraFormValues,
  menuItemExtraFormState,
  type MenuItemExtraFormState,
  validateMenuItemExtraFormValues,
} from "@/lib/menu/menu-extra-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createExtraAction(
  _state: MenuItemExtraFormState,
  formData: FormData,
): Promise<MenuItemExtraFormState> {
  await requireAdmin();
  const values = getMenuItemExtraFormValues(formData);
  const { errors, parsedPrice, parsedDisplayOrder, parsedAppliesTo } =
    validateMenuItemExtraFormValues(values);

  if (
    Object.keys(errors).length ||
    parsedPrice === null ||
    parsedDisplayOrder === null ||
    parsedAppliesTo === null
  ) {
    return menuItemExtraFormState(
      values,
      errors,
      "Controlla i campi evidenziati.",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_item_extras")
      .insert({
        name: values.name,
        group_code: values.groupCode,
        price: parsedPrice,
        applies_to: parsedAppliesTo,
        applies_to_gluten_free: values.appliesToGlutenFree === "true",
        available: values.available === "true",
        display_order: parsedDisplayOrder,
      })
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      return menuItemExtraFormState(
        values,
        {},
        "Impossibile salvare l’extra. Riprova.",
      );
    }
  } catch {
    return menuItemExtraFormState(
      values,
      {},
      "Impossibile salvare l’extra. Riprova.",
    );
  }

  revalidatePath("/ordine");
  revalidatePath("/admin/extra");
  redirect("/admin/extra");
}
