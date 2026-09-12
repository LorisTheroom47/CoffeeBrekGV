export const reservationTimeSlots = [
  "12:00", "12:15", "12:30", "12:45", "13:00",
  "13:15", "13:30", "13:45", "14:00",
] as const;

export type ReservationTimeSlot = (typeof reservationTimeSlots)[number];

export type CreateReservationInput = Readonly<{
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  customerNotes: string;
  idempotencyKey: string;
  turnstileToken: string;
  website?: string;
}>;

export type ReservationFieldErrors = Partial<
  Record<
    | "customerName" | "customerPhone" | "partySize"
    | "reservationDate" | "reservationTime" | "customerNotes"
    | "idempotencyKey" | "turnstileToken",
    string
  >
>;

export type CreateReservationResult =
  | Readonly<{ success: true; reservationNumber: string; status: "confirmed" }>
  | Readonly<{
      success: false;
      message: string;
      fieldErrors?: ReservationFieldErrors;
    }>;

export type ValidatedReservationInput = Readonly<{
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: ReservationTimeSlot;
  customerNotes: string | null;
  idempotencyKey: string;
  turnstileToken: string;
}>;

export type AdminReservation = Readonly<{
  id: string;
  reservationNumber: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  customerNotes: string | null;
  status: "confirmed";
  createdAt: string;
}>;
