import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import BrandLogo from "@/components/BrandLogo";
import { getOrderAccessAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accesso area riservata | Coffee Break GV",
  description: "Accesso all’area riservata di Coffee Break GV.",
};

export default async function AdminLoginPage() {
  const authorization = await getOrderAccessAuthorization();

  if (authorization.status === "authorized") {
    redirect(
      authorization.role === "admin" ? "/admin" : "/admin/ordini",
    );
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
        <BrandLogo className="admin-login-logo" priority />
        <h1 id="admin-login-title">Accesso area riservata</h1>
        <p className="admin-login-intro">
          Inserisci le credenziali del tuo account per accedere all’area
          riservata.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
