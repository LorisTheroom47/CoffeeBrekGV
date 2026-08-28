import { createMenuItemAction } from "@/app/admin/(protected)/piatti/nuovo/actions";
import MenuItemForm from "@/components/admin/MenuItemForm";
import type { AllergenOption, MenuCategoryOption } from "@/lib/menu";

type CreateMenuItemFormProps = Readonly<{
  categories: MenuCategoryOption[];
  allergens: AllergenOption[];
}>;

const initialValues = {
  name: "",
  description: "",
  categoryId: "",
  price: "",
  available: "true",
  orderable: "true",
  customizable: "false",
  allergenIds: [],
};

export default function CreateMenuItemForm({
  categories,
  allergens,
}: CreateMenuItemFormProps) {
  return (
    <MenuItemForm
      action={createMenuItemAction}
      allergens={allergens}
      availabilityLabel="Disponibilità iniziale"
      categories={categories}
      initialValues={initialValues}
      submitLabel="Salva piatto"
    />
  );
}
