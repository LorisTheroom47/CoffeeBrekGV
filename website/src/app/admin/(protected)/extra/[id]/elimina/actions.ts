"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeleteExtraState = Readonly<{ message: string | null }>;

export async function deleteExtraAction(
  extraId: string,
  _state: DeleteExtraState,
  _formData: FormData,
): Promise<DeleteExtraState> {
  await requireAdmin();
  void _state;
  void _formData;

  if (!isValidUuid(extraId)) {
    return { message: "Impossibile eliminare l’extra." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_item_extras")
      .delete()
      .eq("id", extraId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== extraId) {
      return { message: "Impossibile eliminare l’extra. Riprova." };
    }
  } catch {
    return { message: "Impossibile eliminare l’extra. Riprova." };
  }

  revalidatePath("/ordine");
  revalidatePath("/admin/extra");
  redirect("/admin/extra");
}
