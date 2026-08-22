import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCategoryAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DeleteCategoryForm from "@/components/admin/DeleteCategoryForm";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elimina categoria | Coffee Break GV",
  description: "Conferma dell’eliminazione definitiva di una categoria vuota.",
};

type DeleteCategoryPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function DeleteCategoryPage({
  params,
}: DeleteCategoryPageProps) {
  await requireAdmin();

  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  let category: { id: string; name: string } | null = null;
  let itemCount: number | null = null;
  let loadFailed = false;

  try {
    const supabase = await createServerSupabaseClient();
    const [categoryResult, countResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
    ]);

    if (categoryResult.error || countResult.error) {
      loadFailed = true;
    } else {
      category = categoryResult.data;
      itemCount = countResult.count;
      loadFailed = itemCount === null;
    }
  } catch {
    loadFailed = true;
  }

  if (!loadFailed && !category) {
    notFound();
  }

  const deleteAction = deleteCategoryAction.bind(null, id);
  const hasItems = itemCount !== null && itemCount > 0;

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione categorie</p>
            <h1>Elimina categoria</h1>
            <p>Verifica che la categoria sia vuota prima di procedere.</p>
          </div>
        </header>

        <section
          className="admin-form-card admin-delete-card"
          aria-label="Conferma eliminazione categoria"
        >
          {loadFailed || !category || itemCount === null ? (
            <div className="admin-form-empty" role="alert">
              <p>Impossibile eliminare la categoria. Riprova.</p>
              <Link className="button button-secondary" href="/admin/categorie">
                Torna alle categorie
              </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow">Conferma eliminazione</p>
              <h2 className="admin-form-title">{category.name}</h2>

              {hasItems ? (
                <>
                  <div className="admin-delete-warning" role="alert">
                    <strong>
                      Impossibile eliminare la categoria perché contiene ancora
                      dei piatti.
                    </strong>
                    <p>
                      Piatti collegati: {itemCount}. Sposta o elimina i piatti
                      prima di riprovare.
                    </p>
                  </div>
                  <div className="admin-delete-actions">
                    <Link
                      className="button button-secondary"
                      href="/admin/categorie"
                    >
                      Torna alle categorie
                    </Link>
                    <Link className="button button-primary" href="/admin">
                      Visualizza piatti
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-delete-warning" role="alert">
                    <strong>Questa operazione è definitiva.</strong>
                    <p>
                      La categoria verrà rimossa e non potrà essere ripristinata.
                    </p>
                  </div>
                  <div className="admin-delete-actions">
                    <Link
                      className="button button-secondary"
                      href="/admin/categorie"
                    >
                      Annulla
                    </Link>
                    <DeleteCategoryForm action={deleteAction} />
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
