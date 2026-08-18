import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminOrderDetail from "@/components/admin/AdminOrderDetail";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminOrderDetail } from "@/lib/orders/admin-queries";
import { isValidAdminOrderId } from "@/lib/orders/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dettaglio ordine | Coffee Break Monza",
  description: "Dettaglio amministrativo di un ordine Coffee Break Monza.",
};

type AdminOrderDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
  const { id } = await params;

  if (!isValidAdminOrderId(id)) notFound();

  const result = await getAdminOrderDetail(id);

  if (result.status === "not_found") notFound();

  return (
    <main className="admin-shell">
      <AdminSidebar />
      <div className="admin-content">
        {result.status === "error" ? (
          <section className="admin-orders-error" role="alert">
            <h1>Ordine non disponibile</h1>
            <p>Impossibile caricare l’ordine. Riprova.</p>
          </section>
        ) : (
          <AdminOrderDetail order={result.order} items={result.items} />
        )}
      </div>
    </main>
  );
}
