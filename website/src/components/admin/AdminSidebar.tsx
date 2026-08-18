import { getNewAdminOrderCount } from "@/lib/orders/admin-queries";

const navigationItems = [
  { label: "Dashboard", href: "/admin#dashboard" },
  { label: "Menu del giorno", href: "/admin#menu-giorno" },
  { label: "Ordini", href: "/admin/ordini" },
  { label: "Categorie", href: "/admin/categorie" },
  { label: "Anteprima TV", href: "/admin#anteprima-tv" },
  { label: "Impostazioni", href: "/admin#impostazioni" },
];

type SidebarNavigationProps = Readonly<{
  newOrderCount: number | null;
}>;

function SidebarNavigation({ newOrderCount }: SidebarNavigationProps) {
  return (
    <nav className="admin-navigation" aria-label="Navigazione amministratore">
      {navigationItems.map((item) => (
        <a href={item.href} key={item.href}>
          <span>{item.label}</span>
          {item.href === "/admin/ordini" &&
            newOrderCount !== null &&
            newOrderCount > 0 && (
              <span
                className="admin-navigation-badge"
                aria-label={`${newOrderCount} ordini nuovi`}
              >
                {newOrderCount}
              </span>
            )}
        </a>
      ))}
    </nav>
  );
}

export default async function AdminSidebar() {
  const newOrderCount = await getNewAdminOrderCount();

  return (
    <>
      <aside className="admin-sidebar">
        <div>
          <p className="admin-brand">Coffee Break</p>
          <p className="admin-brand-caption">Amministrazione</p>
        </div>
        <SidebarNavigation newOrderCount={newOrderCount} />
        <p className="admin-sidebar-note">Frontend dimostrativo</p>
      </aside>

      <details className="admin-mobile-sidebar">
        <summary>
          <span>Dashboard</span>
          <span className="admin-menu-indicator" aria-hidden="true" />
        </summary>
        <SidebarNavigation newOrderCount={newOrderCount} />
      </details>
    </>
  );
}
