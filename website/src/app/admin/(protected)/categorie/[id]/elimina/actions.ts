"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeleteCategoryState = Readonly<{
  message: string | null;
}>;

const genericErrorMessage = "Impossibile eliminare la categoria. Riprova.";
const categoryNotEmptyMessage =
  "La categoria non può essere eliminata perché contiene ancora dei piatti.";

export async function deleteCategoryAction(
  categoryId: string,
  previousState: DeleteCategoryState,
  formData: FormData,
): Promise<DeleteCategoryState> {
  await requireAdmin();

  void previousState;
  void formData;

  if (!isValidUuid(categoryId)) {
    return { message: genericErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existingCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryError || existingCategory?.id !== categoryId) {
      console.error("Verifica della categoria da eliminare non riuscita.");
      return { message: genericErrorMessage };
    }

    const { count: itemCount, error: countError } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    if (countError || itemCount === null) {
      console.error("Conteggio dei piatti della categoria non riuscito.");
      return { message: genericErrorMessage };
    }

    if (itemCount > 0) {
      return { message: categoryNotEmptyMessage };
    }

    const { data: deletedCategory, error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Eliminazione della categoria non riuscita.");
      return {
        message:
          deleteError.code === "23503"
            ? categoryNotEmptyMessage
            : genericErrorMessage,
      };
    }

    if (deletedCategory?.id !== categoryId) {
      console.error("Verifica dell’eliminazione della categoria non riuscita.");
      return { message: genericErrorMessage };
    }
  } catch {
    console.error("Eliminazione della categoria non riuscita.");
    return { message: genericErrorMessage };
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath("/admin/categorie");
  redirect("/admin/categorie");
}
