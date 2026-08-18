import {
  formatServiceDate,
  type DailyMenuSummary,
} from "@/lib/daily-menus";

type AdminDailyMenuTableProps = Readonly<{
  menus: DailyMenuSummary[];
}>;

function getStatusDetails(status: string) {
  if (status === "draft") {
    return { className: "admin-status-draft", label: "Bozza" };
  }

  if (status === "published") {
    return { className: "admin-status-published", label: "Pubblicato" };
  }

  return { className: "admin-status-unknown", label: "Stato non disponibile" };
}

export default function AdminDailyMenuTable({
  menus,
}: AdminDailyMenuTableProps) {
  return (
    <div className="admin-table-card">
      <table className="admin-menu-table" aria-label="Menu giornalieri">
        <thead>
          <tr>
            <th scope="col">Data del servizio</th>
            <th scope="col">Titolo</th>
            <th scope="col">Stato</th>
          </tr>
        </thead>
        <tbody>
          {menus.length === 0 ? (
            <tr>
              <td className="admin-table-empty" colSpan={3}>
                Nessun menu giornaliero presente.
              </td>
            </tr>
          ) : (
            menus.map((menu) => {
              const status = getStatusDetails(menu.status);

              return (
                <tr key={menu.id}>
                  <td data-label="Data del servizio">
                    <time dateTime={menu.serviceDate}>
                      {formatServiceDate(menu.serviceDate)}
                    </time>
                  </td>
                  <td data-label="Titolo">{menu.title ?? "—"}</td>
                  <td data-label="Stato">
                    <span className={`admin-status ${status.className}`}>
                      {status.label}
                    </span>
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
