"use server";

import { createHash } from "node:crypto";
import type {
  CreateReservationInput,
  CreateReservationResult,
  ReservationFieldErrors,
  ValidatedReservationInput,
} from "@/lib/reservations";
import { validateReservationInput } from "@/lib/reservations";
import { verifyTurnstileToken } from "@/lib/orders/turnstile";
import { createReservationServerSupabaseClient } from "@/lib/supabase/reservation-server";

const MAXIMUM_PAYLOAD_BYTES = 8 * 1024;
const reservationNumberPattern = /^[1-9]\d*$/;
const knownRpcErrors = new Set([
  "INVALID_CUSTOMER_DATA", "INVALID_RESERVATION_DATE",
  "INVALID_RESERVATION_TIME", "RESERVATION_TIME_PASSED",
  "IDEMPOTENCY_CONFLICT", "INVALID_REQUEST",
]);

function failure(message: string, fieldErrors?: ReservationFieldErrors): CreateReservationResult {
  return { success: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function payloadIsAcceptable(input: unknown): boolean {
  try {
    const payload = JSON.stringify(input);
    return payload !== undefined && new TextEncoder().encode(payload).byteLength <= MAXIMUM_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

function honeypotIsClear(input: unknown): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const value = Reflect.get(input, "website");
  return value === undefined || (typeof value === "string" && value.trim() === "");
}

function createFingerprint(input: ValidatedReservationInput): string {
  return createHash("sha256").update(JSON.stringify({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    partySize: input.partySize,
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    customerNotes: input.customerNotes,
  }), "utf8").digest("hex");
}

function rpcFailure(message: string): CreateReservationResult {
  if (!knownRpcErrors.has(message)) {
    return failure("Impossibile confermare la prenotazione. Riprova.");
  }
  if (message === "IDEMPOTENCY_CONFLICT") {
    return failure("La richiesta non è più valida. Ricarica la pagina e riprova.");
  }
  if (message === "RESERVATION_TIME_PASSED") {
    return failure("L’orario scelto non è più disponibile perché è già trascorso.");
  }
  return failure("Controlla i dati della prenotazione e riprova.");
}

export async function createTableReservationAction(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  if (!payloadIsAcceptable(input) || !honeypotIsClear(input)) {
    return failure("Impossibile inviare la prenotazione. Controlla i dati e riprova.");
  }

  const validation = validateReservationInput(input);
  if (!validation.success) {
    return failure("Controlla i campi indicati.", validation.fieldErrors);
  }
  if (!(await verifyTurnstileToken(validation.data.turnstileToken, "reservation_submit"))) {
    return failure("Impossibile completare la verifica di sicurezza. Riprova.");
  }

  const values = validation.data;
  try {
    const supabase = createReservationServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_public_table_reservation", {
      p_customer_name: values.customerName,
      p_customer_phone: values.customerPhone,
      p_party_size: values.partySize,
      p_reservation_date: values.reservationDate,
      p_reservation_time: values.reservationTime,
      p_idempotency_key: values.idempotencyKey,
      p_request_fingerprint: createFingerprint(values),
      p_customer_notes: values.customerNotes,
    });

    if (error) return rpcFailure(error.message);
    if (!Array.isArray(data) || data.length !== 1) {
      return failure("Impossibile confermare la prenotazione. Riprova.");
    }
    const row: unknown = data[0];
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return failure("Impossibile confermare la prenotazione. Riprova.");
    }
    const number = String(Reflect.get(row, "reservation_number"));
    const status = Reflect.get(row, "reservation_status");
    if (!reservationNumberPattern.test(number) || status !== "confirmed") {
      return failure("Impossibile confermare la prenotazione. Riprova.");
    }
    return { success: true, reservationNumber: number, status: "confirmed" };
  } catch {
    return failure("Impossibile confermare la prenotazione. Riprova.");
  }
}
