import type { Metadata } from "next";
import Link from "next/link";
import AdminExtraTable from "@/components/admin/AdminExtraTable";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminMenuItemExtras, type MenuItemExtra } from "@/lib/menu";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Extra | Coffee Break GV",
  description:
    "Gestione degli extra per panini, piadine e prodotti senza glutine.",
};

export default async function AdminExtrasPage() {
  let extras: MenuItemExtra[] | null = null;
  try {
    extras = await getAdminMenuItemExtras();
  } catch {
    // Stato controllato senza dettagli tecnici.
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione menu</p>
            <h1>Extra</h1>
            <p>
              Configura formaggi, verdure e salse per panini, piadine e
              prodotti senza glutine.
            </p>
          </div>
          <Link className="button button-primary" href="/admin/extra/nuovo">
            Nuovo extra
          </Link>
        </header>
        {extras === null ? (
          <div className="admin-form-empty" role="alert">
            Impossibile caricare gli extra. Riprova più tardi.
          </div>
        ) : (
          <AdminExtraTable extras={extras} />
        )}
      </div>
    </main>
  );
}
