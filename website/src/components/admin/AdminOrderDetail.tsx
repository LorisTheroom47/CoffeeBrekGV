import Link from "next/link";
import AdminOrderStatusControls from "@/components/admin/AdminOrderStatusControls";
import {
  formatAdminOrderCreatedAt,
  formatAdminOrderNumber,
  formatAdminOrderTotal,
  formatAdminRequestedDate,
  formatAdminRequestedTime,
  getAdminOrderFulfillmentLabel,
  getAdminOrderStatusPresentation,
  type AdminOrderDetail as AdminOrderDetailData,
  type AdminOrderItemDetail,
} from "@/lib/orders/admin-types";

type AdminOrderDetailProps = Readonly<{
  order: AdminOrderDetailData;
  items: AdminOrderItemDetail[];
}>;

export default function AdminOrderDetail({
  order,
  items,
}: AdminOrderDetailProps) {
  const status = getAdminOrderStatusPresentation(order.status);
  const requestedTime = formatAdminRequestedTime(order.requestedTime);
  const isDelivery = order.fulfillmentType === "delivery";
  const hasNotes = Boolean(order.customerNotes || order.adminNotes);

  return (
    <div className="admin-order-detail">
      <header className="admin-order-detail-header">
        <div>
          <p className="eyebrow">Dettaglio ordine</p>
          <h1>Ordine {formatAdminOrderNumber(order.orderNumber)}</h1>
          <span className={`admin-status ${status.className}`}>
            {status.label}
          </span>
        </div>
        <Link className="button button-secondary" href="/admin/ordini">
          Torna agli ordini
        </Link>
      </header>

      <AdminOrderStatusControls
        currentStatus={order.status}
        fulfillmentType={order.fulfillmentType}
        orderId={order.id}
      />

      <div className="admin-order-detail-grid">
        <section className="admin-order-detail-card" aria-labelledby="customer-title">
          <h2 id="customer-title">Cliente</h2>
          <dl className="admin-order-definition-list">
            <div><dt>Nome</dt><dd>{order.customerName}</dd></div>
            <div><dt>Telefono</dt><dd>{order.customerPhone}</dd></div>
            {order.customerEmail && (
              <div><dt>Email</dt><dd>{order.customerEmail}</dd></div>
            )}
          </dl>
        </section>

        <section className="admin-order-detail-card" aria-labelledby="service-title">
          <h2 id="service-title">Servizio</h2>
          <dl className="admin-order-definition-list">
            <div>
              <dt>Modalità</dt>
              <dd>{getAdminOrderFulfillmentLabel(order.fulfillmentType)}</dd>
            </div>
            {isDelivery && (
              <>
                <div><dt>Indirizzo</dt><dd>{order.deliveryAddress ?? "Non disponibile"}</dd></div>
                <div><dt>Città</dt><dd>{order.deliveryCity ?? "Non disponibile"}</dd></div>
                <div><dt>CAP</dt><dd>{order.deliveryPostalCode ?? "Non disponibile"}</dd></div>
              </>
            )}
          </dl>
        </section>

        <section className="admin-order-detail-card" aria-labelledby="timing-title">
          <h2 id="timing-title">Data e ora</h2>
          <dl className="admin-order-definition-list">
            <div><dt>Data richiesta</dt><dd>{formatAdminRequestedDate(order.requestedDate)}</dd></div>
            {requestedTime && <div><dt>Orario preferito</dt><dd>{requestedTime}</dd></div>}
            <div><dt>Ordine creato</dt><dd>{formatAdminOrderCreatedAt(order.createdAt)}</dd></div>
          </dl>
        </section>
      </div>

      {hasNotes && (
        <section className="admin-order-detail-card admin-order-notes" aria-labelledby="notes-title">
          <h2 id="notes-title">Note ordine</h2>
          {order.customerNotes && <div><h3>Note cliente</h3><p>{order.customerNotes}</p></div>}
          {order.adminNotes && <div><h3>Note amministrative</h3><p>{order.adminNotes}</p></div>}
        </section>
      )}

      <section className="admin-table-card" aria-labelledby="items-title">
        <div className="admin-section-heading">
          <div><p className="eyebrow">Riepilogo piatti</p><h2 id="items-title">Righe ordine</h2></div>
          <p>{items.length} {items.length === 1 ? "riga" : "righe"}</p>
        </div>
        <table className="admin-menu-table admin-order-items-table">
          <thead><tr><th scope="col">Piatto</th><th scope="col">Quantità</th><th scope="col">Prezzo unitario</th><th scope="col">Totale riga</th><th scope="col">Nota</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td data-label="Piatto">{item.itemName}</td>
                <td data-label="Quantità">{item.quantity}</td>
                <td data-label="Prezzo unitario">{formatAdminOrderTotal(item.unitPrice)}</td>
                <td data-label="Totale riga">{formatAdminOrderTotal(item.lineTotal)}</td>
                <td data-label="Nota">{item.customerNotes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-order-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Riepilogo economico</h2>
        <dl>
          <div><dt>Subtotale</dt><dd>{formatAdminOrderTotal(order.subtotal)}</dd></div>
          <div><dt>Consegna</dt><dd>{formatAdminOrderTotal(order.deliveryFee)}</dd></div>
          <div className="admin-order-summary-total"><dt>Totale</dt><dd>{formatAdminOrderTotal(order.total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
