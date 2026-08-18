import Link from "next/link";
import CategoryReorderControls from "@/components/admin/CategoryReorderControls";
import type { AdminCategory } from "@/lib/menu";

type AdminCategoryTableProps = Readonly<{
  categories: AdminCategory[];
}>;

export default function AdminCategoryTable({
  categories,
}: AdminCategoryTableProps) {
  return (
    <div className="admin-table-card">
      <table className="admin-menu-table" aria-label="Categorie del menu">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Slug</th>
            <th scope="col">Piatti collegati</th>
            <th scope="col">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 ? (
            <tr>
              <td className="admin-table-empty" colSpan={4}>
                Nessuna categoria presente.
              </td>
            </tr>
          ) : (
            categories.map((category, index) => (
              <tr key={category.id}>
                <td data-label="Nome">{category.name}</td>
                <td data-label="Slug">{category.slug}</td>
                <td data-label="Piatti collegati">
                  {category.itemCount}{" "}
                  {category.itemCount === 1 ? "piatto" : "piatti"}
                </td>
                <td data-label="Azioni">
                  <div className="admin-table-actions">
                    <CategoryReorderControls
                      canMoveDown={index < categories.length - 1}
                      canMoveUp={index > 0}
                      categoryId={category.id}
                      categoryName={category.name}
                    />
                    <Link
                      className="admin-table-action"
                      href={`/admin/categorie/${category.id}/modifica`}
                    >
                      Modifica
                    </Link>
                    <Link
                      className="admin-table-action admin-table-action-danger"
                      href={`/admin/categorie/${category.id}/elimina`}
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
