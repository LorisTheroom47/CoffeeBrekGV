import Link from "next/link";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import BrandLogo from "@/components/BrandLogo";
import { requireOrderAccess } from "@/lib/auth/authorization";
import { getNewAdminOrderCount } from "@/lib/orders/admin-queries";

const navigationItems = [
  { label: "Dashboard", href: "/admin#dashboard" },
  { label: "Menu del giorno", href: "/admin#menu-giorno" },
  { label: "Ordini", href: "/admin/ordini" },
  { label: "Categorie", href: "/admin/categorie" },
  { label: "Extra", href: "/admin/extra" },
  { label: "Anteprima TV", href: "/admin#anteprima-tv" },
  { label: "Impostazioni", href: "/admin#impostazioni" },
];

type SidebarNavigationProps = Readonly<{
  ariaLabel: string;
  items: typeof navigationItems;
  newOrderCount: number | null;
}>;

function SidebarNavigation({
  ariaLabel,
  items,
  newOrderCount,
}: SidebarNavigationProps) {
  return (
    <nav className="admin-navigation" aria-label={ariaLabel}>
      {items.map((item) => (
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
  const access = await requireOrderAccess();
  const newOrderCount = await getNewAdminOrderCount();
  const items =
    access.role === "admin"
      ? navigationItems
      : navigationItems.filter((item) => item.href === "/admin/ordini");
  const operatorOnly = access.role === "order_operator";
  const navigationLabel = operatorOnly
    ? "Navigazione gestione ordini"
    : "Navigazione amministratore";
  const homeHref = operatorOnly ? "/admin/ordini" : "/admin";

  return (
    <>
      <aside className="admin-sidebar">
        <div>
          <Link
            href={homeHref}
            aria-label={
              operatorOnly
                ? "Coffee Break GV, ordini"
                : "Coffee Break GV, dashboard"
            }
          >
            <BrandLogo className="admin-brand-logo" />
          </Link>
          <p className="admin-brand-caption">
            {operatorOnly ? "Gestione ordini" : "Amministrazione"}
          </p>
        </div>
        <SidebarNavigation
          ariaLabel={navigationLabel}
          items={items}
          newOrderCount={newOrderCount}
        />
        {operatorOnly ? (
          <AdminLogoutButton />
        ) : (
          <p className="admin-sidebar-note">Frontend dimostrativo</p>
        )}
      </aside>

      <details className="admin-mobile-sidebar">
        <summary>
          <BrandLogo className="admin-mobile-logo" />
          <span className="admin-menu-indicator" aria-hidden="true" />
        </summary>
        <SidebarNavigation
          ariaLabel={navigationLabel}
          items={items}
          newOrderCount={newOrderCount}
        />
        {operatorOnly && <AdminLogoutButton />}
      </details>
    </>
  );
}
