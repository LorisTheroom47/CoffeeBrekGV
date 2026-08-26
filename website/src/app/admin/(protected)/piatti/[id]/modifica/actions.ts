"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  allAllergenIdsExist,
  readMenuItemAllergenIds,
} from "@/lib/menu/admin-allergens";
import {
  getMenuItemFormInput,
  isValidUuid,
  menuItemFormErrorState,
  type MenuItemFormState,
  validateMenuItemFormValues,
} from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const genericErrorMessage =
  "Non è stato possibile salvare le modifiche. Riprova più tardi.";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

async function compensateAddedAllergens(
  supabase: ServerSupabaseClient,
  menuItemId: string,
  allergenIds: readonly string[],
) {
  if (allergenIds.length === 0) {
    return;
  }

  try {
    const { error } = await supabase
      .from("menu_item_allergens")
      .delete()
      .eq("menu_item_id", menuItemId)
      .in("allergen_id", [...allergenIds]);

    if (error) {
      console.error("Compensazione delle associazioni aggiunte non riuscita.");
    }
  } catch {
    console.error("Compensazione delle associazioni aggiunte non riuscita.");
  }
}

export async function updateMenuItemAction(
  menuItemId: string,
  _previousState: MenuItemFormState,
  formData: FormData,
): Promise<MenuItemFormState> {
  await requireAdmin();

  const { values, allergenIdsValid } = getMenuItemFormInput(formData);

  if (!isValidUuid(menuItemId)) {
    return menuItemFormErrorState(values, {}, genericErrorMessage);
  }

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

    const { data: existingItem, error: itemError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", menuItemId)
      .maybeSingle();

    if (itemError) {
      console.error("Verifica del piatto non riuscita.");
      return menuItemFormErrorState(values, {}, genericErrorMessage);
    }

    if (!existingItem) {
      return menuItemFormErrorState(
        values,
        {},
        "Il piatto non è più disponibile.",
      );
    }

    const currentAllergenIds = await readMenuItemAllergenIds(
      supabase,
      menuItemId,
    );
    const currentAllergenIdSet = new Set(currentAllergenIds);
    const requestedAllergenIdSet = new Set(values.allergenIds);
    const allergenIdsToAdd = values.allergenIds.filter(
      (id) => !currentAllergenIdSet.has(id),
    );
    const allergenIdsToRemove = currentAllergenIds.filter(
      (id) => !requestedAllergenIdSet.has(id),
    );

    const { data: updatedItem, error: updateError } = await supabase
      .from("menu_items")
      .update({
        name: values.name,
        description: values.description.length > 0 ? values.description : null,
        category_id: category.id,
        price: parsedPrice,
        available: values.available === "true",
        orderable: values.orderable === "true",
      })
      .eq("id", menuItemId)
      .select("id")
      .maybeSingle();

    if (updateError || updatedItem?.id !== menuItemId) {
      console.error("Modifica del piatto non riuscita.");
      return menuItemFormErrorState(values, {}, genericErrorMessage);
    }

    if (allergenIdsToAdd.length > 0) {
      const { error: additionError } = await supabase
        .from("menu_item_allergens")
        .insert(
          allergenIdsToAdd.map((allergenId) => ({
            menu_item_id: menuItemId,
            allergen_id: allergenId,
          })),
        );

      if (additionError) {
        console.error("Aggiunta degli allergeni al piatto non riuscita.");
        return menuItemFormErrorState(values, {}, genericErrorMessage);
      }
    }

    if (allergenIdsToRemove.length > 0) {
      try {
        const { error: removalError } = await supabase
          .from("menu_item_allergens")
          .delete()
          .eq("menu_item_id", menuItemId)
          .in("allergen_id", allergenIdsToRemove);

        if (removalError) {
          console.error("Rimozione degli allergeni dal piatto non riuscita.");
          await compensateAddedAllergens(
            supabase,
            menuItemId,
            allergenIdsToAdd,
          );
          return menuItemFormErrorState(values, {}, genericErrorMessage);
        }
      } catch {
        console.error("Rimozione degli allergeni dal piatto non riuscita.");
        await compensateAddedAllergens(
          supabase,
          menuItemId,
          allergenIdsToAdd,
        );
        return menuItemFormErrorState(values, {}, genericErrorMessage);
      }
    }
  } catch {
    console.error("Modifica del piatto non riuscita.");
    return menuItemFormErrorState(values, {}, genericErrorMessage);
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath(`/admin/piatti/${menuItemId}/modifica`);
  redirect("/admin");
}
