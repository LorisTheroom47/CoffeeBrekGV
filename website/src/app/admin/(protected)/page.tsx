import type { Metadata } from "next";
import Link from "next/link";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminMenuTable from "@/components/admin/AdminMenuTable";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminStats from "@/components/admin/AdminStats";
import AdminUnavailable from "@/components/admin/AdminUnavailable";
import PlaceholderCard from "@/components/admin/PlaceholderCard";
import { getMenuCategories, type MenuCategory } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | Coffee Break Monza",
  description: "Dashboard amministrativa dimostrativa di Coffee Break Monza.",
};

export default async function AdminPage() {
  let categories: MenuCategory[] | null = null;

  try {
    categories = await getMenuCategories();
  } catch {
    // La dashboard mostra uno stato controllato senza dettagli tecnici.
  }

  const items = categories?.flatMap((category) => category.items) ?? [];
  const availableItems = items.filter((item) => item.available).length;
  const unavailableItems = items.length - availableItems;

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <AdminHeader />

        {categories === null ? (
          <AdminUnavailable />
        ) : (
          <>
            <section id="dashboard">
              <AdminStats
                availableItems={availableItems}
                totalCategories={categories.length}
                totalItems={items.length}
                unavailableItems={unavailableItems}
              />
            </section>

            <section id="menu-giorno">
              <AdminMenuTable categories={categories} />
            </section>

            <div className="admin-placeholder-grid">
              <PlaceholderCard
                description={`${categories.length} categorie presenti nel menu corrente.`}
                id="categorie"
                title="Categorie"
              >
                <Link className="button button-primary" href="/admin/categorie">
                  Gestisci categorie
                </Link>
              </PlaceholderCard>
              <PlaceholderCard
                description="Controlla come appare il menu sugli schermi del locale."
                id="anteprima-tv"
                title="Anteprima TV"
              >
                <Link className="button button-primary" href="/tv">
                  Apri modalità TV
                </Link>
              </PlaceholderCard>
              <PlaceholderCard
                description="Funzionalità in sviluppo"
                id="impostazioni"
                title="Impostazioni"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
