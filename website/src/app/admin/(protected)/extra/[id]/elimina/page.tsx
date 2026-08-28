import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExtraAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import DeleteExtraForm from "@/components/admin/DeleteExtraForm";
import {
  getMenuItemExtraForEdit,
  type MenuItemExtraEditData,
} from "@/lib/menu";
import { isValidUuid } from "@/lib/menu/menu-item-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Elimina extra | Coffee Break GV",
};

export default async function DeleteExtraPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isValidUuid(id)) notFound();

  let extra: MenuItemExtraEditData | null | undefined;
  try {
    extra = await getMenuItemExtraForEdit(id);
  } catch {
    extra = undefined;
  }
  if (extra === null) notFound();
  const action = deleteExtraAction.bind(null, id);

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione extra</p>
            <h1>Elimina extra</h1>
          </div>
        </header>
        <section
          className="admin-form-card admin-delete-card"
          aria-label="Conferma eliminazione extra"
        >
          {!extra ? (
            <div className="admin-form-empty" role="alert">
              Impossibile caricare l’extra.
            </div>
          ) : (
            <>
              <p className="eyebrow">Conferma eliminazione</p>
              <h2 className="admin-form-title">{extra.name}</h2>
              <div className="admin-delete-warning" role="alert">
                <strong>Questa operazione è definitiva.</strong>
                <p>Gli ordini storici conserveranno lo snapshot dell’extra.</p>
              </div>
              <div className="admin-delete-actions">
                <Link className="button button-secondary" href="/admin/extra">
                  Annulla
                </Link>
                <DeleteExtraForm action={action} />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
