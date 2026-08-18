import type { AdminOrderSummary } from "@/lib/orders/admin-types";

type AdminOrderStatsProps = {
  orders: AdminOrderSummary[];
};

const workingStatuses = new Set([
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
]);

export default function AdminOrderStats({ orders }: AdminOrderStatsProps) {
  const stats = [
    { label: "Ordini totali", value: orders.length },
    {
      label: "Nuovi",
      value: orders.filter((order) => order.status === "new").length,
    },
    {
      label: "In lavorazione",
      value: orders.filter((order) => workingStatuses.has(order.status)).length,
    },
    {
      label: "Completati",
      value: orders.filter((order) => order.status === "completed").length,
    },
  ];

  return (
    <section className="admin-stats" aria-label="Riepilogo degli ordini">
      {stats.map((stat) => (
        <article className="admin-stat-card" key={stat.label}>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
        </article>
      ))}
    </section>
  );
}
