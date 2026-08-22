import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import BrandLogo from "@/components/BrandLogo";
import { getAdminAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso non autorizzato | Coffee Break GV",
  description: "Accesso non autorizzato all’area amministrativa.",
};

export default async function AdminUnauthorizedPage() {
  const authorization = await getAdminAuthorization();

  if (authorization.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (authorization.status === "authorized") {
    redirect("/admin");
  }

  return (
    <main className="admin-login-page">
      <section
        className="admin-login-card"
        aria-labelledby="admin-unauthorized-title"
      >
        <BrandLogo className="admin-login-logo" priority />
        <h1 id="admin-unauthorized-title">Accesso non autorizzato</h1>
        <p className="admin-login-intro">
          Il tuo account è valido, ma non è abilitato alla gestione del sito.
        </p>
        <AdminLogoutButton />
      </section>
    </main>
  );
}
