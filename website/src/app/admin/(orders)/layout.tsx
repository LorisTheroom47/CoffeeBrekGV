import type { ReactNode } from "react";
import AdminOrderNotifications from "@/components/admin/AdminOrderNotifications";
import { requireOrderAccess } from "@/lib/auth/authorization";

type ProtectedOrdersLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedOrdersLayout({
  children,
}: ProtectedOrdersLayoutProps) {
  await requireOrderAccess();

  return (
    <>
      <AdminOrderNotifications />
      {children}
    </>
  );
}
