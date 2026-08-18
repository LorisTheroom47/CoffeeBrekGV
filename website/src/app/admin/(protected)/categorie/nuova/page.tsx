import type { Metadata } from "next";
import Link from "next/link";
import { createCategoryAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import CategoryForm from "@/components/admin/CategoryForm";

export const metadata: Metadata = {
  title: "Nuova categoria | Coffee Break Monza",
  description: "Creazione di una nuova categoria del menu.",
};

const initialValues = {
  name: "",
  slug: "",
};

export default function NewCategoryPage() {
  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione categorie</p>
            <h1>Nuova categoria</h1>
            <p>Inserisci il nome e lo slug della nuova categoria.</p>
          </div>
          <Link className="button button-secondary" href="/admin/categorie">
            Annulla
          </Link>
        </header>

        <section className="admin-form-card" aria-labelledby="new-category-title">
          <h2 className="admin-form-title" id="new-category-title">
            Dati della categoria
          </h2>
          <CategoryForm
            action={createCategoryAction}
            initialValues={initialValues}
            submitLabel="Salva categoria"
          />
        </section>
      </div>
    </main>
  );
}
