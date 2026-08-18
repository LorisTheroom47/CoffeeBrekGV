"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeleteMenuItemState = Readonly<{
  message: string | null;
}>;

const genericErrorMessage =
  "Non è stato possibile eliminare il piatto. Riprova più tardi.";

export async function deleteMenuItemAction(
  menuItemId: string,
  previousState: DeleteMenuItemState,
  formData: FormData,
): Promise<DeleteMenuItemState> {
  await requireAdmin();

  void previousState;
  void formData;

  if (!isValidUuid(menuItemId)) {
    return { message: genericErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existingItem, error: itemError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", menuItemId)
      .maybeSingle();

    if (itemError) {
      console.error("Verifica del piatto da eliminare non riuscita.");
      return { message: genericErrorMessage };
    }

    if (!existingItem) {
      return { message: "Il piatto non è più disponibile." };
    }

    const { data: deletedItem, error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", menuItemId)
      .select("id")
      .maybeSingle();

    if (deleteError || deletedItem?.id !== menuItemId) {
      console.error("Eliminazione del piatto non riuscita.");
      return { message: genericErrorMessage };
    }
  } catch {
    console.error("Eliminazione del piatto non riuscita.");
    return { message: genericErrorMessage };
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath(`/admin/piatti/${menuItemId}/modifica`);
  revalidatePath(`/admin/piatti/${menuItemId}/elimina`);
  redirect("/admin");
}
