import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateExtraAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import MenuItemExtraForm from "@/components/admin/MenuItemExtraForm";
import {
  getMenuItemExtraForEdit,
  type MenuItemExtraEditData,
} from "@/lib/menu";
import { isValidUuid } from "@/lib/menu/menu-item-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Modifica extra | Coffee Break GV",
};

export default async function EditExtraPage({
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
  const action = updateExtraAction.bind(null, id);

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione extra</p>
            <h1>Modifica extra</h1>
          </div>
          <Link className="button button-secondary" href="/admin/extra">
            Annulla
          </Link>
        </header>
        <section className="admin-form-card" aria-labelledby="edit-extra-title">
          <h2 className="admin-form-title" id="edit-extra-title">
            Dati dell’extra
          </h2>
          {!extra ? (
            <div className="admin-form-empty" role="alert">
              Impossibile caricare l’extra.
            </div>
          ) : (
            <MenuItemExtraForm
              action={action}
              initialValues={{
                name: extra.name,
                groupCode: extra.groupCode,
                price: extra.price.toFixed(2).replace(".", ","),
                appliesTo: extra.appliesTo,
                available: extra.available ? "true" : "false",
                displayOrder: String(extra.displayOrder),
              }}
              submitLabel="Salva modifiche"
            />
          )}
        </section>
      </div>
    </main>
  );
}
