import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminReservation } from "./types";

type RawReservation = {
  id: string;
  reservation_number: string | number;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  customer_notes: string | null;
  status: string;
  created_at: string;
};

export async function getAdminReservations(): Promise<AdminReservation[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("table_reservations")
    .select("id, reservation_number, customer_name, customer_phone, party_size, reservation_date, reservation_time, customer_notes, status, created_at")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error("Impossibile caricare le prenotazioni.");

  return ((data ?? []) as RawReservation[]).flatMap((reservation) => {
    const reservationNumber = String(reservation.reservation_number);
    if (!/^[1-9]\d*$/.test(reservationNumber) || reservation.status !== "confirmed") return [];
    return [{
      id: reservation.id,
      reservationNumber,
      customerName: reservation.customer_name,
      customerPhone: reservation.customer_phone,
      partySize: reservation.party_size,
      reservationDate: reservation.reservation_date,
      reservationTime: reservation.reservation_time,
      customerNotes: reservation.customer_notes?.trim() || null,
      status: "confirmed" as const,
      createdAt: reservation.created_at,
    }];
  });
}
