import Link from "next/link";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

type AdminHeaderProps = {
  title?: string;
  description?: string;
  showNewDishAction?: boolean;
};

export default function AdminHeader({
  title = "Dashboard",
  description = "Gestisci l’anteprima del menu e controlla rapidamente la disponibilità dei piatti.",
  showNewDishAction = true,
}: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <div>
        <p className="eyebrow">Area amministrativa</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="admin-header-actions">
        {showNewDishAction && (
          <Link className="button button-primary" href="/admin/piatti/nuovo">
            Nuovo piatto
          </Link>
        )}
        <AdminLogoutButton />
      </div>
    </header>
  );
}
