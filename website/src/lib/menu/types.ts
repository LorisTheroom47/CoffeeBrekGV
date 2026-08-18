export type MenuItemAllergen = {
  id: string;
  code: number;
  name: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  displayOrder: number;
  imageUrl: string | null;
  allergens: MenuItemAllergen[];
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  items: MenuItem[];
};

export type MenuCategoryOption = {
  id: string;
  name: string;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  itemCount: number;
};

export type CategoryEditData = {
  id: string;
  name: string;
  slug: string;
};

export type AllergenOption = {
  id: string;
  code: number;
  name: string;
};

export type MenuItemEditData = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
};
