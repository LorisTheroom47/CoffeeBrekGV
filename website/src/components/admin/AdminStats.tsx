type AdminStatsProps = {
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  totalCategories: number;
};

export default function AdminStats({
  totalItems,
  availableItems,
  unavailableItems,
  totalCategories,
}: AdminStatsProps) {
  const stats = [
    { label: "Totale piatti", value: totalItems },
    { label: "Piatti disponibili", value: availableItems },
    { label: "Piatti terminati", value: unavailableItems },
    { label: "Numero categorie", value: totalCategories },
  ];

  return (
    <section className="admin-stats" aria-label="Riepilogo del menu">
      {stats.map((stat) => (
        <article className="admin-stat-card" key={stat.label}>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
        </article>
      ))}
    </section>
  );
}
