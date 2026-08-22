import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCategoryAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import CategoryForm from "@/components/admin/CategoryForm";
import { getCategoryForEdit, type CategoryEditData } from "@/lib/menu";
import { isValidUuid } from "@/lib/menu/menu-item-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Modifica categoria | Coffee Break GV",
  description: "Modifica di una categoria del menu.",
};

type EditCategoryPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function EditCategoryPage({
  params,
}: EditCategoryPageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  let category: CategoryEditData | null | undefined;

  try {
    category = await getCategoryForEdit(id);
  } catch {
    // La pagina mostra un errore controllato senza dettagli tecnici.
  }

  if (category === null) {
    notFound();
  }

  const updateAction = updateCategoryAction.bind(null, id);

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione categorie</p>
            <h1>Modifica categoria</h1>
            <p>
              {category ? (
                <>
                  Stai modificando: <strong>{category.name}</strong>
                </>
              ) : (
                "Aggiorna nome e slug della categoria."
              )}
            </p>
          </div>
          <Link className="button button-secondary" href="/admin/categorie">
            Annulla
          </Link>
        </header>

        <section className="admin-form-card" aria-labelledby="edit-category-title">
          <h2 className="admin-form-title" id="edit-category-title">
            Dati della categoria
          </h2>

          {category === undefined ? (
            <div className="admin-form-empty" role="alert">
              <p>Non è stato possibile caricare la categoria.</p>
              <p>Riprova più tardi.</p>
            </div>
          ) : (
            <CategoryForm
              action={updateAction}
              initialValues={{
                name: category.name,
                slug: category.slug,
              }}
              submitLabel="Salva modifiche"
            />
          )}
        </section>
      </div>
    </main>
  );
}
