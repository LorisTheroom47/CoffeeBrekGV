import type { ReactNode } from "react";
import AdminOrderNotifications from "@/components/admin/AdminOrderNotifications";
import { requireAdmin } from "@/lib/auth/authorization";

type ProtectedAdminLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedAdminLayout({
  children,
}: ProtectedAdminLayoutProps) {
  await requireAdmin();

  return (
    <>
      <AdminOrderNotifications />
      {children}
    </>
  );
}
