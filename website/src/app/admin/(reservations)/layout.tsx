import type { ReactNode } from "react";
import AdminOrderNotifications from "@/components/admin/AdminOrderNotifications";
import { requireReservationAccess } from "@/lib/auth/authorization";

type ProtectedReservationsLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedReservationsLayout({
  children,
}: ProtectedReservationsLayoutProps) {
  await requireReservationAccess();

  return (
    <>
      <AdminOrderNotifications />
      {children}
    </>
  );
}
