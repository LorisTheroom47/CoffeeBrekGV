import { redirect } from "next/navigation";
import { getOrderAccessAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const authorization = await getOrderAccessAuthorization();

  if (authorization.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (authorization.status !== "authorized") {
    redirect("/admin/unauthorized");
  }

  redirect(authorization.role === "admin" ? "/admin" : "/admin/ordini");
}
