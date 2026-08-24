import type {
  MenuCategory,
  MenuItem,
  MenuItemAllergen,
} from "./types";
import { getMenuImagePublicUrl } from "./storage";

export type RawMenuCategory = {
  id: string;
  name: string;
  slug: string;
  display_order: number;
};

export type RawMenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
  display_order: number;
  image_url: string | null;
};

export type RawMenuItemAllergen = {
  menu_item_id: string;
  allergen_id: string;
};

export type RawAllergen = {
  id: string;
  code: number;
  name: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRawMenuItemAllergen(
  value: unknown,
): value is RawMenuItemAllergen {
  return (
    isRecord(value) &&
    typeof value.menu_item_id === "string" &&
    typeof value.allergen_id === "string"
  );
}

export function isRawAllergen(value: unknown): value is RawAllergen {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.code === "number" &&
    (typeof value.name === "string" || value.name === null)
  );
}

function compareByOrderAndName(
  first: { displayOrder: number; name: string },
  second: { displayOrder: number; name: string },
) {
  return (
    first.displayOrder - second.displayOrder ||
    first.name.localeCompare(second.name, "it")
  );
}

function mapPrice(price: number | string, itemName: string) {
  const numericPrice = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numericPrice)) {
    throw new Error(`Prezzo non valido per il piatto "${itemName}".`);
  }

  return numericPrice;
}

function compareAllergens(
  first: MenuItemAllergen,
  second: MenuItemAllergen,
) {
  return first.code - second.code || first.name.localeCompare(second.name, "it");
}

function mapMenuItem(
  item: RawMenuItem,
  allergensByMenuItem: ReadonlyMap<string, MenuItemAllergen[]>,
): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: mapPrice(item.price, item.name),
    available: item.available,
    displayOrder: item.display_order,
    imageUrl: getMenuImagePublicUrl(item.image_url),
    allergens: allergensByMenuItem.get(item.id) ?? [],
  };
}

function mapAllergensByMenuItem(
  associations: RawMenuItemAllergen[],
  allergens: RawAllergen[],
): Map<string, MenuItemAllergen[]> {
  const allergensById = new Map<string, MenuItemAllergen>();

  for (const allergen of allergens) {
    const name = allergen.name?.trim();

    if (!name || !Number.isFinite(allergen.code)) {
      continue;
    }

    allergensById.set(allergen.id, {
      id: allergen.id,
      code: allergen.code,
      name,
    });
  }

  const allergenMapsByMenuItem = new Map<
    string,
    Map<string, MenuItemAllergen>
  >();

  for (const association of associations) {
    const allergen = allergensById.get(association.allergen_id);

    if (!allergen) {
      continue;
    }

    const itemAllergens =
      allergenMapsByMenuItem.get(association.menu_item_id) ??
      new Map<string, MenuItemAllergen>();
    itemAllergens.set(allergen.id, allergen);
    allergenMapsByMenuItem.set(association.menu_item_id, itemAllergens);
  }

  return new Map(
    [...allergenMapsByMenuItem].map(([menuItemId, itemAllergens]) => [
      menuItemId,
      [...itemAllergens.values()].sort(compareAllergens),
    ] as const),
  );
}

export function mapMenuCategories(
  categories: RawMenuCategory[],
  items: RawMenuItem[],
  associations: RawMenuItemAllergen[],
  allergens: RawAllergen[],
): MenuCategory[] {
  const itemsByCategory = new Map<string, MenuItem[]>();
  const allergensByMenuItem = mapAllergensByMenuItem(
    associations,
    allergens,
  );

  for (const item of items) {
    const categoryItems = itemsByCategory.get(item.category_id) ?? [];
    categoryItems.push(mapMenuItem(item, allergensByMenuItem));
    itemsByCategory.set(item.category_id, categoryItems);
  }

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.display_order,
      items: (itemsByCategory.get(category.id) ?? []).sort(
        compareByOrderAndName,
      ),
    }))
    .sort(compareByOrderAndName);
}
