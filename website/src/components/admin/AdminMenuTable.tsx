import Link from "next/link";
import MenuItemReorderControls from "@/components/admin/MenuItemReorderControls";
import type { MenuCategory as MenuCategoryData } from "@/lib/menu";

type AdminMenuTableProps = {
  categories: MenuCategoryData[];
};

const priceFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export default function AdminMenuTable({ categories }: AdminMenuTableProps) {
  const rows = categories.flatMap((category) =>
    category.items.map((item, index) => ({
      ...item,
      categoryName: category.name,
      canMoveUp: index > 0,
      canMoveDown: index < category.items.length - 1,
    })),
  );

  return (
    <div className="admin-table-card">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Contenuti correnti</p>
          <h2 id="admin-menu-title">Menu del giorno</h2>
        </div>
        <p>{rows.length} piatti configurati</p>
      </div>

      <table className="admin-menu-table" aria-labelledby="admin-menu-title">
        <thead>
          <tr>
            <th scope="col">Nome piatto</th>
            <th scope="col">Categoria</th>
            <th scope="col">Prezzo</th>
            <th scope="col">Disponibilità</th>
            <th scope="col">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="admin-table-empty" colSpan={5}>
                Nessun piatto presente nel menu.
              </td>
            </tr>
          ) : (
            rows.map((item) => (
              <tr key={item.id}>
                <td data-label="Nome piatto">{item.name}</td>
                <td data-label="Categoria">{item.categoryName}</td>
                <td data-label="Prezzo">{priceFormatter.format(item.price)}</td>
                <td data-label="Disponibilità">
                  <span
                    className={`admin-status ${
                      item.available
                        ? "admin-status-available"
                        : "admin-status-unavailable"
                    }`}
                  >
                    {item.available ? "Disponibile" : "Terminato"}
                  </span>
                </td>
                <td data-label="Azioni">
                  <div className="admin-table-actions">
                    <MenuItemReorderControls
                      canMoveDown={item.canMoveDown}
                      canMoveUp={item.canMoveUp}
                      itemId={item.id}
                      itemName={item.name}
                    />
                    <Link
                      className="admin-table-action"
                      href={`/admin/piatti/${item.id}/modifica`}
                    >
                      Modifica
                    </Link>
                    <Link
                      className="admin-table-action admin-table-action-danger"
                      href={`/admin/piatti/${item.id}/elimina`}
                    >
                      Elimina
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
