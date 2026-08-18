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
import { createServerSupabaseClient } from "@/lib/supabase/server";

const genericErrorMessage = "Impossibile salvare la categoria. Riprova.";
const maximumPostgresInteger = 2_147_483_647;

export async function createCategoryAction(
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const values = getCategoryFormValues(formData);
  const errors = validateCategoryFormValues(values);

  if (Object.keys(errors).length > 0) {
    return categoryFormErrorState(
      values,
      errors,
      "Controlla i campi evidenziati.",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existingCategory, error: slugError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", values.slug)
      .maybeSingle();

    if (slugError) {
      console.error("Verifica dello slug della categoria non riuscita.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }

    if (existingCategory) {
      return categoryFormErrorState(values, {
        slug: "Questo slug è già utilizzato.",
      });
    }

    const { data: lastCategory, error: orderError } = await supabase
      .from("categories")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      console.error("Calcolo dell’ordine della categoria non riuscito.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }

    const currentOrder = lastCategory?.display_order;

    if (
      currentOrder !== undefined &&
      (!Number.isInteger(currentOrder) ||
        currentOrder < 0 ||
        currentOrder >= maximumPostgresInteger)
    ) {
      console.error("Ordine della categoria non valido.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }

    const displayOrder =
      typeof currentOrder === "number" ? currentOrder + 1 : 0;
    const { data: insertedCategory, error: insertError } = await supabase
      .from("categories")
      .insert({
        name: values.name,
        slug: values.slug,
        display_order: displayOrder,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !insertedCategory?.id) {
      console.error("Creazione della categoria non riuscita.");
      return categoryFormErrorState(values, {}, genericErrorMessage);
    }
  } catch {
    console.error("Creazione della categoria non riuscita.");
    return categoryFormErrorState(values, {}, genericErrorMessage);
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath("/admin/categorie");
  redirect("/admin/categorie");
}
