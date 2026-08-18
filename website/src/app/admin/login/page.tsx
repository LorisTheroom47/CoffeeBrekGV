import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { getAdminAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso amministratore | Coffee Break Monza",
  description: "Accesso all’area amministrativa di Coffee Break Monza.",
};

export default async function AdminLoginPage() {
  const authorization = await getAdminAuthorization();

  if (authorization.status === "authorized") {
    redirect("/admin");
  }

  if (
    authorization.status === "unauthorized" ||
    authorization.status === "error"
  ) {
    redirect("/admin/unauthorized");
  }

  return (
    <main className="admin-login-page">
      <section
        className="admin-login-card"
        aria-labelledby="admin-login-title"
      >
        <p className="admin-login-brand">Coffee Break Monza</p>
        <h1 id="admin-login-title">Accesso amministratore</h1>
        <p className="admin-login-intro">
          Inserisci le credenziali del tuo account per accedere alla dashboard.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
