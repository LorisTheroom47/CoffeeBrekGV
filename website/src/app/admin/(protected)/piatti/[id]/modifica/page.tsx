import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateMenuItemAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import MenuItemForm from "@/components/admin/MenuItemForm";
import {
  getAllergenOptions,
  getMenuCategoryOptions,
  getMenuItemAllergenIds,
  getMenuItemForEdit,
  type AllergenOption,
  type MenuCategoryOption,
  type MenuItemEditData,
} from "@/lib/menu";
import {
  formatPriceForInput,
  isValidUuid,
} from "@/lib/menu/menu-item-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modifica piatto | Coffee Break GV",
  description: "Modifica di un piatto del menu.",
};

type EditMenuItemPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditMenuItemPage({
  params,
}: EditMenuItemPageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  let item: MenuItemEditData | null = null;
  let categories: MenuCategoryOption[] | null = null;
  let allergens: AllergenOption[] | null = null;
  let selectedAllergenIds: string[] | null = null;

  try {
    [item, categories, allergens, selectedAllergenIds] = await Promise.all([
      getMenuItemForEdit(id),
      getMenuCategoryOptions(),
      getAllergenOptions(),
      getMenuItemAllergenIds(id),
    ]);
  } catch {
    // La pagina mostra un errore controllato senza dettagli tecnici.
  }

  if (
    categories !== null &&
    allergens !== null &&
    selectedAllergenIds !== null &&
    item === null
  ) {
    notFound();
  }

  const updateAction = updateMenuItemAction.bind(null, id);

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione menu</p>
            <h1>Modifica piatto</h1>
            <p>
              {item ? (
                <>
                  Stai modificando: <strong>{item.name}</strong>
                </>
              ) : (
                "Aggiorna le informazioni del piatto."
              )}
            </p>
          </div>
          <Link className="button button-secondary" href="/admin">
            Annulla
          </Link>
        </header>

        <section className="admin-form-card" aria-labelledby="edit-item-form-title">
          <h2 className="admin-form-title" id="edit-item-form-title">
            Dati del piatto
          </h2>

          {!item ||
          categories === null ||
          allergens === null ||
          selectedAllergenIds === null ? (
            <div className="admin-form-empty" role="alert">
              <p>Non è stato possibile caricare il piatto.</p>
              <p>Riprova più tardi.</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="admin-form-empty" role="status">
              <p>Non sono presenti categorie disponibili.</p>
              <p>Non è possibile modificare il piatto in questo momento.</p>
            </div>
          ) : (
            <MenuItemForm
              action={updateAction}
              allergens={allergens}
              availabilityLabel="Disponibilità"
              categories={categories}
              initialValues={{
                name: item.name,
                description: item.description ?? "",
                categoryId: item.categoryId,
                price: formatPriceForInput(item.price),
                available: item.available ? "true" : "false",
                allergenIds: selectedAllergenIds,
              }}
              submitLabel="Salva modifiche"
            />
          )}
        </section>
      </div>
    </main>
  );
}
