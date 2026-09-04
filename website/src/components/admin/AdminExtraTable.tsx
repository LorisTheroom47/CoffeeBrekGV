import Link from "next/link";
import type { MenuItemExtra } from "@/lib/menu";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const groupLabels = {
  FORMAGGIO: "Formaggio",
  VERDURA: "Verdura",
  SALSA: "Salsa",
} as const;

const scopeLabels = {
  PANINO: ["Panini"],
  PIADINA: ["Piadine"],
  ENTRAMBI: ["Panini", "Piadine"],
} as const;

function getApplicabilityLabels(extra: MenuItemExtra): string[] {
  const labels: string[] = [...scopeLabels[extra.appliesTo]];

  if (extra.appliesToGlutenFree) labels.push("Prodotti senza glutine");
  return labels;
}

export default function AdminExtraTable({
  extras,
}: Readonly<{ extras: MenuItemExtra[] }>) {
  return (
    <div className="admin-table-card">
      <div className="admin-section-heading">
        <div><p className="eyebrow">Personalizzazioni</p><h2>Catalogo extra</h2></div>
        <p>{extras.length} extra</p>
      </div>
      <table className="admin-menu-table">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Gruppo</th>
            <th scope="col">Prezzo</th>
            <th scope="col">Applicabile a</th>
            <th scope="col">Disponibilità</th>
            <th scope="col">Ordine</th>
            <th scope="col">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {extras.length === 0 ? (
            <tr><td className="admin-table-empty" colSpan={7}>Nessun extra configurato.</td></tr>
          ) : extras.map((extra) => (
            <tr key={extra.id}>
              <td data-label="Nome">{extra.name}</td>
              <td data-label="Gruppo">{groupLabels[extra.groupCode]}</td>
              <td data-label="Prezzo">{money.format(extra.price)}</td>
              <td data-label="Applicabile a">
                <div className="admin-extra-scope-list">
                  {getApplicabilityLabels(extra).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </td>
              <td data-label="Disponibilità">
                <span className={`admin-status ${extra.available ? "admin-status-available" : "admin-status-unavailable"}`}>
                  {extra.available ? "Disponibile" : "Non disponibile"}
                </span>
              </td>
              <td data-label="Ordine">{extra.displayOrder}</td>
              <td data-label="Azioni">
                <div className="admin-table-actions">
                  <Link className="admin-table-action admin-table-action-primary" href={`/admin/extra/${extra.id}/modifica`}>Modifica</Link>
                  <Link className="admin-table-action admin-table-action-danger" href={`/admin/extra/${extra.id}/elimina`}>Elimina</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
