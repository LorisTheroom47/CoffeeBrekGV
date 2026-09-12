import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminReservationTable from "@/components/admin/AdminReservationTable";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getAdminReservations } from "@/lib/reservations/admin";
import type { AdminReservation } from "@/lib/reservations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Prenotazioni | Coffee Break GV",
  description: "Elenco amministrativo delle prenotazioni tavoli.",
};

export default async function AdminReservationsPage() {
  let reservations: AdminReservation[] | null = null;
  try { reservations = await getAdminReservations(); } catch { reservations = null; }

  return <main className="admin-shell"><AdminSidebar /><div className="admin-content">
    <AdminHeader title="Prenotazioni" description="Consulta le prenotazioni tavoli confermate." showNewDishAction={false} />
    {reservations === null ? <section className="admin-orders-error" role="alert"><h2>Prenotazioni non disponibili</h2><p>Impossibile caricare le prenotazioni. Riprova.</p></section> : <AdminReservationTable reservations={reservations} />}
  </div></main>;
}
