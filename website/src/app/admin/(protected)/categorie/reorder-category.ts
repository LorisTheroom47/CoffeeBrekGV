"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ReorderCategoryState = Readonly<{
  message: string | null;
}>;

type ReorderDirection = "up" | "down";

type OrderedCategory = Readonly<{
  id: string;
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

function isOrderedCategory(value: unknown): value is OrderedCategory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const category = value as Record<string, unknown>;
  return (
    typeof category.id === "string" &&
    typeof category.name === "string" &&
    isValidDisplayOrder(category.display_order)
  );
}

function getTargetOrders(
  currentOrder: number,
  neighborOrder: number,
  direction: ReorderDirection,
) {
  if (currentOrder !== neighborOrder) {
    return { current: neighborOrder, neighbor: currentOrder };
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
  category: OrderedCategory,
  expectedOrder: number,
  nextOrder: number,
) {
  const { data, error } = await supabase
    .from("categories")
    .update({ display_order: nextOrder })
    .eq("id", category.id)
    .eq("display_order", expectedOrder)
    .select("id, display_order")
    .maybeSingle();

  return (
    !error &&
    data?.id === category.id &&
    data.display_order === nextOrder
  );
}

export async function reorderCategoryAction(
  categoryId: string,
  _previousState: ReorderCategoryState,
  formData: FormData,
): Promise<ReorderCategoryState> {
  await requireAdmin();

  const direction = formData.get("direction");

  if (!isValidUuid(categoryId) || !isDirection(direction)) {
    return { message: genericErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: currentData, error: currentError } = await supabase
      .from("categories")
      .select("id, name, display_order")
      .eq("id", categoryId)
      .maybeSingle();

    if (currentError || !isOrderedCategory(currentData)) {
      console.error("Verifica della categoria da riordinare non riuscita.");
      return { message: genericErrorMessage };
    }

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    const rawCategories = categoriesData ?? [];
    const categories = rawCategories.filter(isOrderedCategory);

    if (categoriesError || categories.length !== rawCategories.length) {
      console.error("Caricamento dell’ordine delle categorie non riuscito.");
      return { message: genericErrorMessage };
    }

    const currentIndex = categories.findIndex(
      (category) => category.id === currentData.id,
    );

    if (currentIndex < 0) {
      return { message: genericErrorMessage };
    }

    const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const neighbor = categories[neighborIndex];

    if (!neighbor) {
      return { message: null };
    }

    const targetOrders = getTargetOrders(
      currentData.display_order,
      neighbor.display_order,
      direction,
    );
    const firstUpdate = {
      category: currentData,
      expectedOrder: currentData.display_order,
      nextOrder: targetOrders.current,
    };

    if (
      !(await updateDisplayOrder(
        supabase,
        firstUpdate.category,
        firstUpdate.expectedOrder,
        firstUpdate.nextOrder,
      ))
    ) {
      console.error("Primo aggiornamento dell’ordine non riuscito.");
      return { message: genericErrorMessage };
    }

    if (
      !(await updateDisplayOrder(
        supabase,
        neighbor,
        neighbor.display_order,
        targetOrders.neighbor,
      ))
    ) {
      console.error("Secondo aggiornamento dell’ordine non riuscito.");

      if (
        !(await updateDisplayOrder(
          supabase,
          firstUpdate.category,
          firstUpdate.nextOrder,
          firstUpdate.expectedOrder,
        ))
      ) {
        console.error("Compensazione del riordinamento non riuscita.");
      }

      return { message: genericErrorMessage };
    }
  } catch {
    console.error("Riordinamento della categoria non riuscito.");
    return { message: genericErrorMessage };
  }

  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath("/admin/categorie");
  redirect("/admin/categorie");
}
