"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  categoryFormErrorState,
  getCategoryFormValues,
  type CategoryFormState,
  validateCategoryFormValues,
} from "@/lib/menu/category-form";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const genericErrorMessage = "Impossibile salvare la categoria. Riprova.";

export async function updateCategoryAction(
  categoryId: string,
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const values = getCategoryFormValues(formData);

  if (!isValidUuid(categoryId)) {
    return categoryFormErrorState(values, {}, genericErrorMessage);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existingCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryError) {
      console.error("Verifica della categoria non riuscita.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }

    if (!existingCategory) {
      return categoryFormErrorState(
        values,
        {},
        "Impossibile salvare la categoria. Riprova.",
      );
    }

    const errors = validateCategoryFormValues(values);

    if (Object.keys(errors).length > 0) {
      return categoryFormErrorState(
        values,
        errors,
        "Controlla i campi evidenziati.",
      );
    }

    const { data: categoryWithSlug, error: slugError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", values.slug)
      .neq("id", categoryId)
      .maybeSingle();

    if (slugError) {
      console.error("Verifica dello slug della categoria non riuscita.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }

    if (categoryWithSlug) {
      return categoryFormErrorState(values, {
        slug: "Questo slug è già utilizzato.",
      });
    }

    const { data: updatedCategory, error: updateError } = await supabase
      .from("categories")
      .update({
        name: values.name,
        slug: values.slug,
      })
      .eq("id", categoryId)
      .select("id")
      .maybeSingle();

    if (updateError || updatedCategory?.id !== categoryId) {
      console.error("Modifica della categoria non riuscita.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }
  } catch {
    console.error("Modifica della categoria non riuscita.");
    return categoryFormErrorState(values, {}, genericErrorMessage);
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath("/admin/categorie");
  revalidatePath(`/admin/categorie/${categoryId}/modifica`);
  redirect("/admin/categorie");
}
