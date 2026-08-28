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
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateExtraAction(
  extraId: string,
  _state: MenuItemExtraFormState,
  formData: FormData,
): Promise<MenuItemExtraFormState> {
  await requireAdmin();
  const values = getMenuItemExtraFormValues(formData);
  const { errors, parsedPrice, parsedDisplayOrder } =
    validateMenuItemExtraFormValues(values);

  if (!isValidUuid(extraId)) {
    return menuItemExtraFormState(values, {}, "Impossibile salvare l’extra.");
  }
  if (
    Object.keys(errors).length ||
    parsedPrice === null ||
    parsedDisplayOrder === null
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
      .update({
        name: values.name,
        group_code: values.groupCode,
        price: parsedPrice,
        applies_to: values.appliesTo,
        available: values.available === "true",
        display_order: parsedDisplayOrder,
      })
      .eq("id", extraId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== extraId) {
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
  revalidatePath(`/admin/extra/${extraId}/modifica`);
  redirect("/admin/extra");
}
