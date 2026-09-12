import {
  reservationTimeSlots,
  type CreateReservationInput,
  type ReservationFieldErrors,
  type ReservationTimeSlot,
  type ValidatedReservationInput,
} from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validSlots = new Set<string>(reservationTimeSlots);

type ValidationResult =
  | Readonly<{ success: true; data: ValidatedReservationInput }>
  | Readonly<{ success: false; fieldErrors: ReservationFieldErrors }>;

function isRealDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function getRomeDateAndTime(): Readonly<{ date: string; time: string }> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    calendar: "iso8601", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    minute: "2-digit", month: "2-digit", timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    time: `${values.get("hour")}:${values.get("minute")}`,
  };
}

export function validateReservationInput(rawInput: unknown): ValidationResult {
  const input: CreateReservationInput =
    typeof rawInput === "object" && rawInput !== null && !Array.isArray(rawInput)
      ? {
          customerName: typeof Reflect.get(rawInput, "customerName") === "string" ? Reflect.get(rawInput, "customerName") as string : "",
          customerPhone: typeof Reflect.get(rawInput, "customerPhone") === "string" ? Reflect.get(rawInput, "customerPhone") as string : "",
          partySize: typeof Reflect.get(rawInput, "partySize") === "number" ? Reflect.get(rawInput, "partySize") as number : Number.NaN,
          reservationDate: typeof Reflect.get(rawInput, "reservationDate") === "string" ? Reflect.get(rawInput, "reservationDate") as string : "",
          reservationTime: typeof Reflect.get(rawInput, "reservationTime") === "string" ? Reflect.get(rawInput, "reservationTime") as string : "",
          customerNotes: typeof Reflect.get(rawInput, "customerNotes") === "string" ? Reflect.get(rawInput, "customerNotes") as string : "",
          idempotencyKey: typeof Reflect.get(rawInput, "idempotencyKey") === "string" ? Reflect.get(rawInput, "idempotencyKey") as string : "",
          turnstileToken: typeof Reflect.get(rawInput, "turnstileToken") === "string" ? Reflect.get(rawInput, "turnstileToken") as string : "",
          website: typeof Reflect.get(rawInput, "website") === "string" ? Reflect.get(rawInput, "website") as string : undefined,
        }
      : {
          customerName: "", customerPhone: "", partySize: Number.NaN,
          reservationDate: "", reservationTime: "", customerNotes: "",
          idempotencyKey: "", turnstileToken: "",
        };
  const fieldErrors: ReservationFieldErrors = {};
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const customerNotes = input.customerNotes.trim();
  const reservationDate = input.reservationDate.trim();
  const reservationTime = input.reservationTime.trim();
  const idempotencyKey = input.idempotencyKey.trim().toLowerCase();
  const turnstileToken = input.turnstileToken.trim();
  const nowInRome = getRomeDateAndTime();

  if (!customerName || customerName.length > 120) {
    fieldErrors.customerName = "Inserisci un nome valido.";
  }
  if (!customerPhone || customerPhone.length > 40) {
    fieldErrors.customerPhone = "Inserisci un numero di telefono valido.";
  }
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 8) {
    fieldErrors.partySize = "Seleziona da 1 a 8 persone.";
  }
  if (!isRealDate(reservationDate) || reservationDate < nowInRome.date) {
    fieldErrors.reservationDate = "Seleziona una data valida, non passata.";
  }
  if (!validSlots.has(reservationTime)) {
    fieldErrors.reservationTime = "Seleziona un orario tra le 12:00 e le 14:00.";
  } else if (reservationDate === nowInRome.date && reservationTime <= nowInRome.time) {
    fieldErrors.reservationTime = "Per oggi seleziona un orario ancora futuro.";
  }
  if (customerNotes.length > 1000) {
    fieldErrors.customerNotes = "Le note possono contenere al massimo 1000 caratteri.";
  }
  if (!uuidV4Pattern.test(idempotencyKey)) {
    fieldErrors.idempotencyKey = "Impossibile inviare la prenotazione. Riprova.";
  }
  if (!turnstileToken) {
    fieldErrors.turnstileToken = "Completa la verifica di sicurezza.";
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  return {
    success: true,
    data: {
      customerName,
      customerPhone,
      partySize: input.partySize,
      reservationDate,
      reservationTime: reservationTime as ReservationTimeSlot,
      customerNotes: customerNotes || null,
      idempotencyKey,
      turnstileToken,
    },
  };
}
