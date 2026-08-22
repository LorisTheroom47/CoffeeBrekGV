import Link from "next/link";
import {
  formatAdminOrderCreatedAt,
  formatAdminOrderNumber,
  formatAdminOrderTotal,
  formatAdminRequestedDate,
  formatAdminRequestedTime,
  getAdminDeliveryPointLabel,
  getAdminOrderFulfillmentLabel,
  getAdminOrderStatusPresentation,
  type AdminOrderSummary,
} from "@/lib/orders/admin-types";

type AdminOrderTableProps = {
  orders: AdminOrderSummary[];
};

export default function AdminOrderTable({ orders }: AdminOrderTableProps) {
  return (
    <div className="admin-table-card">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Gestione ordini</p>
          <h2 id="admin-orders-title">Ordini ricevuti</h2>
        </div>
        <p>{orders.length} ordini presenti</p>
      </div>

      <table
        className="admin-menu-table admin-orders-table"
        aria-labelledby="admin-orders-title"
      >
        <thead>
          <tr>
            <th scope="col">Ordine</th>
            <th scope="col">Cliente</th>
            <th scope="col">Modalità</th>
            <th scope="col">Richiesto per</th>
            <th scope="col">Totale</th>
            <th scope="col">Stato</th>
            <th scope="col">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td className="admin-table-empty" colSpan={7}>
                Nessun ordine ricevuto.
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const status = getAdminOrderStatusPresentation(order.status);
              const requestedTime = formatAdminRequestedTime(
                order.requestedTime,
              );

              return (
                <tr key={order.id}>
                  <td data-label="Ordine">
                    <strong>{formatAdminOrderNumber(order.orderNumber)}</strong>
                    <small>{formatAdminOrderCreatedAt(order.createdAt)}</small>
                  </td>
                  <td data-label="Cliente">{order.customerName}</td>
                  <td data-label="Modalità">
                    {getAdminOrderFulfillmentLabel(order.fulfillmentType)}
                    {order.fulfillmentType === "delivery" && (
                      <small>{getAdminDeliveryPointLabel(order.deliveryPoint)}</small>
                    )}
                  </td>
                  <td data-label="Richiesto per">
                    <span>{formatAdminRequestedDate(order.requestedDate)}</span>
                    {requestedTime && <small>{requestedTime}</small>}
                  </td>
                  <td data-label="Totale">
                    {formatAdminOrderTotal(order.total)}
                  </td>
                  <td data-label="Stato">
                    <span className={`admin-status ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td data-label="Azioni">
                    <Link
                      className="admin-table-action"
                      href={`/admin/ordini/${order.id}`}
                      aria-label={`Dettagli ${formatAdminOrderNumber(order.orderNumber)}`}
                    >
                      Dettagli
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
