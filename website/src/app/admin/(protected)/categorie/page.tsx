import type { Metadata } from "next";
import Link from "next/link";
import AdminCategoryTable from "@/components/admin/AdminCategoryTable";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminCategories, type AdminCategory } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categorie | Coffee Break Monza",
  description: "Gestione delle categorie del menu di Coffee Break Monza.",
};

export default async function AdminCategoriesPage() {
  let categories: AdminCategory[] | null = null;

  try {
    categories = await getAdminCategories();
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
            <h1>Categorie</h1>
            <p>Gestisci i nomi e gli slug delle categorie del menu.</p>
          </div>
          <div className="admin-header-actions">
            <Link className="button button-primary" href="/admin/categorie/nuova">
              Nuova categoria
            </Link>
            <Link className="button button-secondary" href="/admin">
              Dashboard
            </Link>
          </div>
        </header>

        {categories === null ? (
          <section className="admin-form-empty" role="alert">
            <p>Non è stato possibile caricare le categorie.</p>
            <p>Riprova più tardi.</p>
          </section>
        ) : (
          <AdminCategoryTable categories={categories} />
        )}
      </div>
    </main>
  );
}
