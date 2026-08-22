import type { Metadata } from "next";
import Link from "next/link";
import AdminSidebar from "@/components/admin/AdminSidebar";
import CreateMenuItemForm from "@/components/admin/CreateMenuItemForm";
import {
  getAllergenOptions,
  getMenuCategoryOptions,
  type AllergenOption,
  type MenuCategoryOption,
} from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuovo piatto | Coffee Break GV",
  description: "Creazione di un nuovo piatto del menu.",
};

export default async function NewMenuItemPage() {
  let categories: MenuCategoryOption[] | null = null;
  let allergens: AllergenOption[] | null = null;

  try {
    [categories, allergens] = await Promise.all([
      getMenuCategoryOptions(),
      getAllergenOptions(),
    ]);
  } catch {
    // La pagina mostra un errore controllato senza dettagli tecnici.
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione menu</p>
            <h1>Nuovo piatto</h1>
            <p>Inserisci le informazioni che compariranno nel menu.</p>
          </div>
          <Link className="button button-secondary" href="/admin">
            Annulla
          </Link>
        </header>

        <section className="admin-form-card" aria-labelledby="new-item-form-title">
          <h2 className="admin-form-title" id="new-item-form-title">
            Dati del piatto
          </h2>

          {categories === null || allergens === null ? (
            <div className="admin-form-empty" role="alert">
              <p>Non è stato possibile caricare i dati necessari.</p>
              <p>Riprova più tardi.</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="admin-form-empty" role="status">
              <p>Non sono presenti categorie disponibili.</p>
              <p>Non è possibile creare un piatto in questo momento.</p>
            </div>
          ) : (
            <CreateMenuItemForm categories={categories} allergens={allergens} />
          )}
        </section>
      </div>
    </main>
  );
}
