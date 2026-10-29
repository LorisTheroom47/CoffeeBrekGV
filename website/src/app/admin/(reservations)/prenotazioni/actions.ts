"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireReservationAccess } from "@/lib/auth/authorization";
import { reservationTimeSlots } from "@/lib/reservations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeleteReservationState = Readonly<{ message: string | null }>;

export type UpdateReservationField =
  | "customerName"
  | "customerPhone"
  | "partySize"
  | "reservationDate"
  | "reservationTime"
  | "customerNotes";

export type UpdateReservationState = Readonly<{
  message: string | null;
  fieldErrors?: Partial<Record<UpdateReservationField, string>>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validReservationTimes = new Set<string>(reservationTimeSlots);
const genericDeleteError = "Impossibile eliminare la prenotazione. Riprova.";
const genericUpdateError = "Impossibile modificare la prenotazione. Riprova.";

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isRealDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getRomeDateAndTime(): Readonly<{ date: string; time: string }> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    calendar: "iso8601",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    time: `${values.get("hour")}:${values.get("minute")}`,
  };
}

export async function deleteTableReservationAction(
  reservationId: string,
  previousState: DeleteReservationState,
  formData: FormData,
): Promise<DeleteReservationState> {
  void previousState;
  void formData;
  await requireReservationAccess();

  if (!uuidPattern.test(reservationId)) {
    return { message: genericDeleteError };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: result, error } = await supabase.rpc(
      "delete_table_reservation",
      { p_reservation_id: reservationId },
    );

    if (error || typeof result !== "string") {
      return { message: genericDeleteError };
    }
    if (result === "access_denied") {
      return { message: "Non hai i permessi per eliminare questa prenotazione." };
    }
    if (result === "invalid_id") {
      return { message: "Identificativo della prenotazione non valido." };
    }
    if (result === "not_found") {
      return { message: "La prenotazione non è più disponibile." };
    }
    if (result !== "deleted") {
      return { message: genericDeleteError };
    }
  } catch {
    return { message: genericDeleteError };
  }

  revalidatePath("/admin/prenotazioni");
  redirect("/admin/prenotazioni");
}

export async function updateTableReservationAction(
  reservationId: string,
  previousState: UpdateReservationState,
  formData: FormData,
): Promise<UpdateReservationState> {
  void previousState;
  await requireReservationAccess();

  if (!uuidPattern.test(reservationId)) {
    return { message: genericUpdateError };
  }

  const customerName = getText(formData, "customerName");
  const customerPhone = getText(formData, "customerPhone");
  const rawPartySize = getText(formData, "partySize");
  const reservationDate = getText(formData, "reservationDate");
  const reservationTime = getText(formData, "reservationTime");
  const customerNotes = getText(formData, "customerNotes");
  const partySize = Number(rawPartySize);
  const nowInRome = getRomeDateAndTime();
  const fieldErrors: Partial<Record<UpdateReservationField, string>> = {};

  if (!customerName || customerName.length > 120) {
    fieldErrors.customerName = "Inserisci un nome valido.";
  }
  if (!customerPhone || customerPhone.length > 40) {
    fieldErrors.customerPhone = "Inserisci un numero di telefono valido.";
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) {
    fieldErrors.partySize = "Seleziona da 1 a 8 persone.";
  }
  if (!isRealDate(reservationDate) || reservationDate < nowInRome.date) {
    fieldErrors.reservationDate = "Seleziona una data valida, non passata.";
  }
  if (!validReservationTimes.has(reservationTime)) {
    fieldErrors.reservationTime = "Seleziona un orario tra le 12:00 e le 14:00.";
  } else if (
    reservationDate === nowInRome.date &&
    reservationTime <= nowInRome.time
  ) {
    fieldErrors.reservationTime = "Per oggi seleziona un orario ancora futuro.";
  }
  if (customerNotes.length > 1000) {
    fieldErrors.customerNotes = "Le note possono contenere al massimo 1000 caratteri.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Controlla i dati inseriti.", fieldErrors };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: result, error } = await supabase.rpc(
      "update_table_reservation",
      {
        p_reservation_id: reservationId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_party_size: partySize,
        p_reservation_date: reservationDate,
        p_reservation_time: reservationTime,
        p_customer_notes: customerNotes || null,
      },
    );

    if (error || typeof result !== "string") {
      return { message: genericUpdateError };
    }
    if (result === "access_denied") {
      return { message: "Non hai i permessi per modificare questa prenotazione." };
    }
    if (result === "invalid_id") {
      return { message: "Identificativo della prenotazione non valido." };
    }
    if (result === "invalid_data") {
      return { message: "I dati inseriti non sono validi." };
    }
    if (result === "not_found") {
      return { message: "La prenotazione non è più disponibile." };
    }
    if (result !== "updated") {
      return { message: genericUpdateError };
    }
  } catch {
    return { message: genericUpdateError };
  }

  revalidatePath("/admin/prenotazioni");
  redirect("/admin/prenotazioni");
}
