import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMenuItemAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DeleteMenuItemForm from "@/components/admin/DeleteMenuItemForm";
import { requireAdmin } from "@/lib/auth/authorization";
import { getMenuItemForEdit, type MenuItemEditData } from "@/lib/menu";
import { isValidUuid } from "@/lib/menu/menu-item-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elimina piatto | Coffee Break GV",
  description: "Conferma dell’eliminazione definitiva di un piatto.",
};

type DeleteMenuItemPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function DeleteMenuItemPage({
  params,
}: DeleteMenuItemPageProps) {
  await requireAdmin();

  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  let item: MenuItemEditData | null = null;
  let loadFailed = false;

  try {
    item = await getMenuItemForEdit(id);
  } catch {
    loadFailed = true;
  }

  if (!loadFailed && !item) {
    notFound();
  }

  const deleteAction = deleteMenuItemAction.bind(null, id);

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione menu</p>
            <h1>Elimina piatto</h1>
            <p>Conferma con attenzione prima di procedere.</p>
          </div>
        </header>

        <section
          className="admin-form-card admin-delete-card"
          aria-label="Conferma eliminazione piatto"
        >
          {loadFailed || !item ? (
            <div className="admin-form-empty" role="alert">
              <p>Non è stato possibile caricare il piatto.</p>
              <p>Riprova più tardi.</p>
              <Link className="button button-secondary" href="/admin">
                Annulla
              </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow">Conferma eliminazione</p>
              <h2 className="admin-form-title">
                {item.name}
              </h2>
              <div className="admin-delete-warning" role="alert">
                <strong>Questa operazione è definitiva.</strong>
                <p>
                  Il piatto verrà rimosso dal menu e non potrà essere
                  ripristinato.
                </p>
              </div>
              <div className="admin-delete-actions">
                <Link className="button button-secondary" href="/admin">
                  Annulla
                </Link>
                <DeleteMenuItemForm action={deleteAction} />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
