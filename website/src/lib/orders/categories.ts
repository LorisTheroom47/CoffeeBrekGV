export const orderCategoryFilters = [
  { name: "Primi", slug: "primi" },
  { name: "Secondi", slug: "secondi" },
  { name: "Insalate", slug: "insalate" },
  { name: "Panini", slug: "panini" },
  { name: "Piadine", slug: "piadine" },
  { name: "Bevande", slug: "bevande" },
  {
    name: "Brioches di pasticceria",
    slug: "brioches-di-pasticceria",
  },
  {
    name: "Prodotti senza glutine",
    slug: "prodotti-senza-glutine",
  },
] as const;

export type OrderCategorySlug = (typeof orderCategoryFilters)[number]["slug"];

export function isOrderCategorySlug(value: unknown): value is OrderCategorySlug {
  return orderCategoryFilters.some((category) => category.slug === value);
}
