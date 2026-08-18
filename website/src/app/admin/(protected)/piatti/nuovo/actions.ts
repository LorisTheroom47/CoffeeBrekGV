"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { allAllergenIdsExist } from "@/lib/menu/admin-allergens";
import {
  getMenuItemFormInput,
  menuItemFormErrorState,
  type MenuItemFormState,
  validateMenuItemFormValues,
} from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
const genericErrorMessage =
  "Non è stato possibile salvare il piatto. Riprova più tardi.";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

async function compensateCreatedMenuItem(
  supabase: ServerSupabaseClient,
  menuItemId: string,
) {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", menuItemId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== menuItemId) {
      console.error("Compensazione del nuovo piatto non riuscita.");
      return;
    }

    console.error(
      "Creazione delle associazioni non riuscita; nuovo piatto eliminato.",
    );
  } catch {
    console.error("Compensazione del nuovo piatto non riuscita.");
  }
}

export async function createMenuItemAction(
  _previousState: MenuItemFormState,
  formData: FormData,
): Promise<MenuItemFormState> {
  await requireAdmin();

  const { values, allergenIdsValid } = getMenuItemFormInput(formData);
  const { errors, parsedPrice } = validateMenuItemFormValues(
    values,
    allergenIdsValid,
  );

  if (Object.keys(errors).length > 0 || parsedPrice === null) {
    return menuItemFormErrorState(
      values,
      errors,
      errors.allergenIds
        ? "Controlla la selezione degli allergeni."
        : "Controlla i campi evidenziati.",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", values.categoryId)
      .maybeSingle();

    if (categoryError) {
      console.error("Verifica della categoria non riuscita.");
      return menuItemFormErrorState(values, {}, genericErrorMessage);
    }

    if (!category) {
      return menuItemFormErrorState(values, {
        categoryId: "La categoria selezionata non è più disponibile.",
      });
    }

    const allergensExist = await allAllergenIdsExist(
      supabase,
      values.allergenIds,
    );

    if (!allergensExist) {
      return menuItemFormErrorState(
        values,
        { allergenIds: "La selezione degli allergeni non è valida." },
        "Controlla la selezione degli allergeni.",
      );
    }

    const { data: lastItem, error: orderError } = await supabase
      .from("menu_items")
      .select("display_order")
      .eq("category_id", values.categoryId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      console.error("Calcolo dell’ordinamento del piatto non riuscito.");
      return menuItemFormErrorState(values, {}, genericErrorMessage);
    }

    const currentOrder = lastItem?.display_order;
    const displayOrder =
      typeof currentOrder === "number" &&
      Number.isInteger(currentOrder) &&
      currentOrder >= 0
        ? currentOrder + 1
        : 0;

    const { data: insertedItem, error: insertError } = await supabase
      .from("menu_items")
      .insert({
        category_id: category.id,
        name: values.name,
        description: values.description.length > 0 ? values.description : null,
        price: parsedPrice,
        available: values.available === "true",
        display_order: displayOrder,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !insertedItem?.id) {
      console.error("Creazione del piatto non riuscita.");
      return menuItemFormErrorState(values, {}, genericErrorMessage);
    }

    if (values.allergenIds.length > 0) {
      try {
        const { error: associationError } = await supabase
          .from("menu_item_allergens")
          .insert(
            values.allergenIds.map((allergenId) => ({
              menu_item_id: insertedItem.id,
              allergen_id: allergenId,
            })),
          );

        if (associationError) {
          await compensateCreatedMenuItem(supabase, insertedItem.id);
          return menuItemFormErrorState(values, {}, genericErrorMessage);
        }
      } catch {
        await compensateCreatedMenuItem(supabase, insertedItem.id);
        return menuItemFormErrorState(values, {}, genericErrorMessage);
      }
    }
  } catch {
    console.error("Creazione del piatto non riuscita.");
    return menuItemFormErrorState(values, {}, genericErrorMessage);
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  redirect("/admin");
}
