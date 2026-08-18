import type { MenuItemAllergen } from "@/lib/menu";

type MenuItemAllergensProps = Readonly<{
  allergens: MenuItemAllergen[];
}>;

export default function MenuItemAllergens({
  allergens,
}: MenuItemAllergensProps) {
  const uniqueAllergens = new Map<string, MenuItemAllergen>();

  for (const allergen of allergens) {
    const name = allergen.name.trim();

    if (name) {
      uniqueAllergens.set(allergen.id, { ...allergen, name });
    }
  }

  const names = [...uniqueAllergens.values()]
    .sort(
      (first, second) =>
        first.code - second.code ||
        first.name.localeCompare(second.name, "it"),
    )
    .map(({ name }) => name);

  if (names.length === 0) {
    return null;
  }

  return (
    <p className="menu-item-allergens">
      <span className="menu-item-allergens-label">Allergeni:</span>{" "}
      {names.join(" · ")}
    </p>
  );
}
