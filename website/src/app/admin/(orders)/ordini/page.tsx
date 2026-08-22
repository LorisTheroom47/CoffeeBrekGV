import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminOrderStats from "@/components/admin/AdminOrderStats";
import AdminOrderTable from "@/components/admin/AdminOrderTable";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminOrderSummaries } from "@/lib/orders/admin-queries";
import type { AdminOrderSummary } from "@/lib/orders/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ordini | Coffee Break GV",
  description: "Elenco amministrativo degli ordini di Coffee Break GV.",
};

export default async function AdminOrdersPage() {
  let orders: AdminOrderSummary[] | null = null;

  try {
    orders = await getAdminOrderSummaries();
  } catch {
    // La pagina mantiene il layout e non espone dettagli Supabase.
  }

  return (
    <main className="admin-shell">
      <AdminSidebar />

      <div className="admin-content">
        <AdminHeader
          description="Consulta gli ordini ricevuti e il loro stato corrente."
          showNewDishAction={false}
          title="Ordini"
        />

        {orders === null ? (
          <section className="admin-orders-error" role="alert">
            <h2>Ordini non disponibili</h2>
            <p>Impossibile caricare gli ordini. Riprova.</p>
          </section>
        ) : (
          <>
            <AdminOrderStats orders={orders} />
            <AdminOrderTable orders={orders} />
          </>
        )}
      </div>
    </main>
  );
}
