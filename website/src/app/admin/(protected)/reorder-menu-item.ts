"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ReorderMenuItemState = Readonly<{
  message: string | null;
}>;

type ReorderDirection = "up" | "down";

type OrderedMenuItem = Readonly<{
  id: string;
  category_id: string;
  name: string;
  display_order: number;
}>;

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

const genericErrorMessage = "Impossibile modificare l’ordine. Riprova.";
const maximumPostgresInteger = 2_147_483_647;

function isDirection(value: FormDataEntryValue | null): value is ReorderDirection {
  return value === "up" || value === "down";
}

function isValidDisplayOrder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximumPostgresInteger
  );
}

function isOrderedMenuItem(value: unknown): value is OrderedMenuItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.category_id === "string" &&
    typeof item.name === "string" &&
    isValidDisplayOrder(item.display_order)
  );
}

function getTargetOrders(
  currentOrder: number,
  neighborOrder: number,
  direction: ReorderDirection,
) {
  if (currentOrder !== neighborOrder) {
    return {
      current: neighborOrder,
      neighbor: currentOrder,
    };
  }

  const earlierOrder =
    currentOrder < maximumPostgresInteger
      ? currentOrder
      : currentOrder - 1;
  const laterOrder =
    currentOrder < maximumPostgresInteger
      ? currentOrder + 1
      : currentOrder;

  return direction === "up"
    ? { current: earlierOrder, neighbor: laterOrder }
    : { current: laterOrder, neighbor: earlierOrder };
}

async function updateDisplayOrder(
  supabase: ServerSupabaseClient,
  item: OrderedMenuItem,
  expectedOrder: number,
  nextOrder: number,
) {
  const { data, error } = await supabase
    .from("menu_items")
    .update({ display_order: nextOrder })
    .eq("id", item.id)
    .eq("category_id", item.category_id)
    .eq("display_order", expectedOrder)
    .select("id, category_id, display_order")
    .maybeSingle();

  return (
    !error &&
    data?.id === item.id &&
    data.category_id === item.category_id &&
    data.display_order === nextOrder
  );
}

export async function reorderMenuItemAction(
  menuItemId: string,
  _previousState: ReorderMenuItemState,
  formData: FormData,
): Promise<ReorderMenuItemState> {
  await requireAdmin();

  const direction = formData.get("direction");

  if (!isValidUuid(menuItemId) || !isDirection(direction)) {
    return { message: genericErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: currentItemData, error: currentItemError } = await supabase
      .from("menu_items")
      .select("id, category_id, name, display_order")
      .eq("id", menuItemId)
      .maybeSingle();

    if (currentItemError || !isOrderedMenuItem(currentItemData)) {
      console.error("Verifica del piatto da riordinare non riuscita.");
      return { message: genericErrorMessage };
    }

    const { data: categoryItemsData, error: categoryItemsError } =
      await supabase
        .from("menu_items")
        .select("id, category_id, name, display_order")
        .eq("category_id", currentItemData.category_id)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

    const rawCategoryItems = categoryItemsData ?? [];
    const categoryItems = rawCategoryItems.filter(isOrderedMenuItem);

    if (
      categoryItemsError ||
      categoryItems.length !== rawCategoryItems.length ||
      categoryItems.some(
        (item) => item.category_id !== currentItemData.category_id,
      )
    ) {
      console.error("Caricamento dell’ordine della categoria non riuscito.");
      return { message: genericErrorMessage };
    }

    const currentIndex = categoryItems.findIndex(
      (item) => item.id === currentItemData.id,
    );

    if (currentIndex < 0) {
      return { message: genericErrorMessage };
    }

    const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const neighbor = categoryItems[neighborIndex];

    if (!neighbor) {
      return { message: null };
    }

    const targetOrders = getTargetOrders(
      currentItemData.display_order,
      neighbor.display_order,
      direction,
    );
    const updates = [
      {
        item: currentItemData,
        expectedOrder: currentItemData.display_order,
        nextOrder: targetOrders.current,
      },
      {
        item: neighbor,
        expectedOrder: neighbor.display_order,
        nextOrder: targetOrders.neighbor,
      },
    ];

    const firstUpdate = updates[0];

    if (
      firstUpdate &&
      !(await updateDisplayOrder(
        supabase,
        firstUpdate.item,
        firstUpdate.expectedOrder,
        firstUpdate.nextOrder,
      ))
    ) {
      console.error("Primo aggiornamento dell’ordine non riuscito.");
      return { message: genericErrorMessage };
    }

    const secondUpdate = updates[1];

    if (
      secondUpdate &&
      !(await updateDisplayOrder(
        supabase,
        secondUpdate.item,
        secondUpdate.expectedOrder,
        secondUpdate.nextOrder,
      ))
    ) {
      console.error("Secondo aggiornamento dell’ordine non riuscito.");

      if (
        firstUpdate &&
        !(await updateDisplayOrder(
          supabase,
          firstUpdate.item,
          firstUpdate.nextOrder,
          firstUpdate.expectedOrder,
        ))
      ) {
        console.error("Compensazione del riordinamento non riuscita.");
      }

      return { message: genericErrorMessage };
    }
  } catch {
    console.error("Riordinamento del piatto non riuscito.");
    return { message: genericErrorMessage };
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  redirect("/admin");
}
