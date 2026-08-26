import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isRawAllergen,
  isRawMenuItemAllergen,
  mapMenuCategories,
  type RawMenuCategory,
  type RawMenuItem,
} from "./mapper";
import type {
  AdminCategory,
  AllergenOption,
  CategoryEditData,
  MenuCategory,
  MenuCategoryOption,
  MenuItemEditData,
} from "./types";
import { readMenuItemAllergenIds } from "./admin-allergens";

const publicErrorMessage = "Il menu non è temporaneamente disponibile.";

export async function getMenuCategories(): Promise<MenuCategory[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const [
      categoriesResult,
      itemsResult,
      associationsResult,
      allergensResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("menu_items")
        .select(
          "id, category_id, name, description, price, available, orderable, display_order, image_url",
        )
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("menu_item_allergens")
        .select("menu_item_id, allergen_id"),
      supabase
        .from("allergens")
        .select("id, code, name")
        .order("code", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (associationsResult.error) {
      throw associationsResult.error;
    }

    if (allergensResult.error) {
      throw allergensResult.error;
    }

    return mapMenuCategories(
      (categoriesResult.data ?? []) as RawMenuCategory[],
      (itemsResult.data ?? []) as RawMenuItem[],
      (associationsResult.data ?? []).filter(isRawMenuItemAllergen),
      (allergensResult.data ?? []).filter(isRawAllergen),
    );
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getMenuCategoryOptions(): Promise<MenuCategoryOption[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as MenuCategoryOption[];
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getMenuItemForEdit(
  id: string,
): Promise<MenuItemEditData | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, available, orderable, image_url",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      categoryId: data.category_id,
      name: data.name,
      description: data.description,
      price: data.price,
      available: data.available,
      orderable: data.orderable,
      imageUrl: data.image_url,
    } as MenuItemEditData;
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getAllergenOptions(): Promise<AllergenOption[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("allergens")
      .select("id, code, name")
      .order("code", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as AllergenOption[];
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getMenuItemAllergenIds(
  menuItemId: string,
): Promise<string[]> {
  try {
    const supabase = await createServerSupabaseClient();
    return await readMenuItemAllergenIds(supabase, menuItemId);
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("menu_items").select("category_id"),
    ]);

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    const itemCounts = new Map<string, number>();

    for (const item of itemsResult.data ?? []) {
      if (typeof item.category_id !== "string") {
        continue;
      }

      itemCounts.set(
        item.category_id,
        (itemCounts.get(item.category_id) ?? 0) + 1,
      );
    }

    return (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.display_order,
      itemCount: itemCounts.get(category.id) ?? 0,
    }));
  } catch {
    throw new Error(publicErrorMessage);
  }
}

export async function getCategoryForEdit(
  id: string,
): Promise<CategoryEditData | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? { id: data.id, name: data.name, slug: data.slug }
      : null;
  } catch {
    throw new Error(publicErrorMessage);
  }
}
