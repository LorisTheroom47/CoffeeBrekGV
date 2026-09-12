"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import {
  getProductOptionFormValues,
  getProductOptionGroupFormValues,
  productOptionGroupFormState,
  type ProductOptionDeleteState,
  type ProductOptionFormState,
  type ProductOptionGroupFormState,
  validateProductOptionFormValues,
  validateProductOptionGroupFormValues,
} from "@/lib/menu/product-option-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

function editPath(menuItemId: string): string {
  return `/admin/piatti/${menuItemId}/modifica`;
}

function returnToEditor(menuItemId: string): never {
  const path = editPath(menuItemId);
  revalidatePath(path);
  revalidatePath("/ordine");
  redirect(`${path}#product-options`);
}

async function groupBelongsToMenuItem(
  supabase: ServerSupabaseClient,
  menuItemId: string,
  groupId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("menu_item_option_groups")
    .select("id")
    .eq("id", groupId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  return !error && data?.id === groupId;
}

export async function createProductOptionGroupAction(
  menuItemId: string,
  _state: ProductOptionGroupFormState,
  formData: FormData,
): Promise<ProductOptionGroupFormState> {
  await requireAdmin();
  const values = getProductOptionGroupFormValues(formData);
  const { errors, displayOrder, selectionType } =
    validateProductOptionGroupFormValues(values);

  if (!isValidUuid(menuItemId)) {
    return productOptionGroupFormState(
      values,
      {},
      "Impossibile creare il gruppo.",
    );
  }
  if (Object.keys(errors).length || displayOrder === null || !selectionType) {
    return productOptionGroupFormState(
      values,
      errors,
      "Controlla i campi evidenziati.",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_item_option_groups")
      .insert({
        menu_item_id: menuItemId,
        name: values.name,
        selection_type: selectionType,
        available: values.available === "true",
        display_order: displayOrder,
      })
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      return productOptionGroupFormState(
        values,
        {},
        "Impossibile creare il gruppo. Riprova.",
      );
    }
  } catch {
    return productOptionGroupFormState(
      values,
      {},
      "Impossibile creare il gruppo. Riprova.",
    );
  }

  returnToEditor(menuItemId);
}

export async function updateProductOptionGroupAction(
  menuItemId: string,
  groupId: string,
  _state: ProductOptionGroupFormState,
  formData: FormData,
): Promise<ProductOptionGroupFormState> {
  await requireAdmin();
  const values = getProductOptionGroupFormValues(formData);
  const { errors, displayOrder, selectionType } =
    validateProductOptionGroupFormValues(values);

  if (!isValidUuid(menuItemId) || !isValidUuid(groupId)) {
    return productOptionGroupFormState(
      values,
      {},
      "Impossibile modificare il gruppo.",
    );
  }
  if (Object.keys(errors).length || displayOrder === null || !selectionType) {
    return productOptionGroupFormState(
      values,
      errors,
      "Controlla i campi evidenziati.",
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_item_option_groups")
      .update({
        name: values.name,
        selection_type: selectionType,
        available: values.available === "true",
        display_order: displayOrder,
      })
      .eq("id", groupId)
      .eq("menu_item_id", menuItemId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== groupId) {
      return productOptionGroupFormState(
        values,
        {},
        "Impossibile modificare il gruppo. Riprova.",
      );
    }
  } catch {
    return productOptionGroupFormState(
      values,
      {},
      "Impossibile modificare il gruppo. Riprova.",
    );
  }

  returnToEditor(menuItemId);
}

export async function deleteProductOptionGroupAction(
  menuItemId: string,
  groupId: string,
  _state: ProductOptionDeleteState,
  _formData: FormData,
): Promise<ProductOptionDeleteState> {
  void _state;
  void _formData;
  await requireAdmin();

  if (!isValidUuid(menuItemId) || !isValidUuid(groupId)) {
    return { message: "Impossibile eliminare il gruppo." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_item_option_groups")
      .delete()
      .eq("id", groupId)
      .eq("menu_item_id", menuItemId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== groupId) {
      return { message: "Impossibile eliminare il gruppo. Riprova." };
    }
  } catch {
    return { message: "Impossibile eliminare il gruppo. Riprova." };
  }

  returnToEditor(menuItemId);
}

export async function createProductOptionAction(
  menuItemId: string,
  groupId: string,
  _state: ProductOptionFormState,
  formData: FormData,
): Promise<ProductOptionFormState> {
  await requireAdmin();
  const values = getProductOptionFormValues(formData);
  const { errors, price, displayOrder } =
    validateProductOptionFormValues(values);

  if (!isValidUuid(menuItemId) || !isValidUuid(groupId)) {
    return { values, errors: {}, message: "Impossibile creare l’opzione." };
  }
  if (Object.keys(errors).length || price === null || displayOrder === null) {
    return {
      values,
      errors,
      message: "Controlla i campi evidenziati.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();

    if (!(await groupBelongsToMenuItem(supabase, menuItemId, groupId))) {
      return {
        values,
        errors: {},
        message: "Il gruppo selezionato non è disponibile.",
      };
    }

    const { data, error } = await supabase
      .from("menu_item_options")
      .insert({
        group_id: groupId,
        name: values.name,
        price,
        available: values.available === "true",
        display_order: displayOrder,
      })
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      return {
        values,
        errors: {},
        message: "Impossibile creare l’opzione. Riprova.",
      };
    }
  } catch {
    return {
      values,
      errors: {},
      message: "Impossibile creare l’opzione. Riprova.",
    };
  }

  returnToEditor(menuItemId);
}

export async function updateProductOptionAction(
  menuItemId: string,
  groupId: string,
  optionId: string,
  _state: ProductOptionFormState,
  formData: FormData,
): Promise<ProductOptionFormState> {
  await requireAdmin();
  const values = getProductOptionFormValues(formData);
  const { errors, price, displayOrder } =
    validateProductOptionFormValues(values);

  if (
    !isValidUuid(menuItemId) ||
    !isValidUuid(groupId) ||
    !isValidUuid(optionId)
  ) {
    return { values, errors: {}, message: "Impossibile modificare l’opzione." };
  }
  if (Object.keys(errors).length || price === null || displayOrder === null) {
    return {
      values,
      errors,
      message: "Controlla i campi evidenziati.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();

    if (!(await groupBelongsToMenuItem(supabase, menuItemId, groupId))) {
      return {
        values,
        errors: {},
        message: "Il gruppo selezionato non è disponibile.",
      };
    }

    const { data, error } = await supabase
      .from("menu_item_options")
      .update({
        name: values.name,
        price,
        available: values.available === "true",
        display_order: displayOrder,
      })
      .eq("id", optionId)
      .eq("group_id", groupId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== optionId) {
      return {
        values,
        errors: {},
        message: "Impossibile modificare l’opzione. Riprova.",
      };
    }
  } catch {
    return {
      values,
      errors: {},
      message: "Impossibile modificare l’opzione. Riprova.",
    };
  }

  returnToEditor(menuItemId);
}

export async function deleteProductOptionAction(
  menuItemId: string,
  groupId: string,
  optionId: string,
  _state: ProductOptionDeleteState,
  _formData: FormData,
): Promise<ProductOptionDeleteState> {
  void _state;
  void _formData;
  await requireAdmin();

  if (
    !isValidUuid(menuItemId) ||
    !isValidUuid(groupId) ||
    !isValidUuid(optionId)
  ) {
    return { message: "Impossibile eliminare l’opzione." };
  }

  try {
    const supabase = await createServerSupabaseClient();

    if (!(await groupBelongsToMenuItem(supabase, menuItemId, groupId))) {
      return { message: "Il gruppo selezionato non è disponibile." };
    }

    const { data, error } = await supabase
      .from("menu_item_options")
      .delete()
      .eq("id", optionId)
      .eq("group_id", groupId)
      .select("id")
      .maybeSingle();

    if (error || data?.id !== optionId) {
      return { message: "Impossibile eliminare l’opzione. Riprova." };
    }
  } catch {
    return { message: "Impossibile eliminare l’opzione. Riprova." };
  }

  returnToEditor(menuItemId);
}
