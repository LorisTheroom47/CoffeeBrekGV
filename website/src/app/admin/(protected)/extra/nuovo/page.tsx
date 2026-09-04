import type { Metadata } from "next";
import Link from "next/link";
import { createExtraAction } from "./actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import MenuItemExtraForm from "@/components/admin/MenuItemExtraForm";

export const metadata: Metadata = {
  title: "Nuovo extra | Coffee Break GV",
  description:
    "Creazione di un extra per panini, piadine e prodotti senza glutine.",
};

const initialValues = {
  name: "",
  groupCode: "FORMAGGIO",
  price: "0,00",
  appliesToPanini: "true",
  appliesToPiadine: "true",
  appliesToGlutenFree: "false",
  available: "true",
  displayOrder: "0",
};

export default function NewExtraPage() {
  return (
    <main className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Gestione extra</p>
            <h1>Nuovo extra</h1>
          </div>
          <Link className="button button-secondary" href="/admin/extra">
            Annulla
          </Link>
        </header>
        <section className="admin-form-card" aria-labelledby="new-extra-title">
          <h2 className="admin-form-title" id="new-extra-title">
            Dati dell’extra
          </h2>
          <MenuItemExtraForm
            action={createExtraAction}
            initialValues={initialValues}
            submitLabel="Salva extra"
          />
        </section>
      </div>
    </main>
  );
}
