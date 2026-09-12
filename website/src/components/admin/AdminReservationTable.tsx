import type { AdminReservation } from "@/lib/reservations";
import AdminReservationDeleteControl from "@/components/admin/AdminReservationDeleteControl";

type AdminReservationTableProps = Readonly<{ reservations: AdminReservation[] }>;

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome",
});

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

export default function AdminReservationTable({ reservations }: AdminReservationTableProps) {
  return <div className="admin-table-card">
    <div className="admin-section-heading"><div><p className="eyebrow">Sala</p><h2 id="admin-reservations-title">Prenotazioni ricevute</h2></div><p>{reservations.length} prenotazioni</p></div>
    <table className="admin-menu-table admin-reservations-table" aria-labelledby="admin-reservations-title">
      <thead><tr><th scope="col">Prenotazione</th><th scope="col">Data</th><th scope="col">Ora</th><th scope="col">Cliente</th><th scope="col">Telefono</th><th scope="col">Persone</th><th scope="col">Note</th><th scope="col">Stato</th><th scope="col">Azioni</th></tr></thead>
      <tbody>{reservations.length === 0 ? <tr><td className="admin-table-empty" colSpan={9}>Nessuna prenotazione ricevuta.</td></tr> : reservations.map((reservation) => <tr key={reservation.id}>
        <td data-label="Prenotazione"><strong>n. {reservation.reservationNumber}</strong></td>
        <td data-label="Data">{formatDate(reservation.reservationDate)}</td>
        <td data-label="Ora">{formatTime(reservation.reservationTime)}</td>
        <td data-label="Cliente">{reservation.customerName}</td>
        <td data-label="Telefono"><a href={`tel:${reservation.customerPhone.replace(/\s+/g, "")}`}>{reservation.customerPhone}</a></td>
        <td data-label="Persone">{reservation.partySize}</td>
        <td data-label="Note">{reservation.customerNotes ?? "—"}</td>
        <td data-label="Stato"><span className="admin-status admin-status-available">Confermata</span></td>
        <td data-label="Azioni"><AdminReservationDeleteControl reservationId={reservation.id} reservationNumber={reservation.reservationNumber} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
