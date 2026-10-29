"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateTableReservationAction,
  type UpdateReservationField,
  type UpdateReservationState,
} from "@/app/admin/(reservations)/prenotazioni/actions";
import { reservationTimeSlots, type AdminReservation } from "@/lib/reservations";
import styles from "./AdminReservationEditControl.module.css";

type AdminReservationEditControlProps = Readonly<{
  reservation: AdminReservation;
}>;

const initialState: UpdateReservationState = { message: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "Salvataggio…" : "Salva modifiche"}
    </button>
  );
}

function FieldError({
  field,
  state,
}: Readonly<{
  field: UpdateReservationField;
  state: UpdateReservationState;
}>) {
  const message = state.fieldErrors?.[field];
  return message ? (
    <span className={styles.error} role="alert">
      {message}
    </span>
  ) : null;
}

export default function AdminReservationEditControl({
  reservation,
}: AdminReservationEditControlProps) {
  const [open, setOpen] = useState(false);
  const action = updateTableReservationAction.bind(null, reservation.id);
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        className="admin-table-action"
        onClick={() => setOpen(true)}
        type="button"
      >
        Modifica
      </button>

      {open && (
        <div className={styles.backdrop}>
          <section
            aria-labelledby={`edit-reservation-${reservation.id}`}
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <div className={styles.heading}>
              <div>
                <h3 id={`edit-reservation-${reservation.id}`}>
                  Modifica prenotazione n. {reservation.reservationNumber}
                </h3>
                <p>Aggiorna i dati e salva la prenotazione.</p>
              </div>
              <button
                aria-label="Chiudi modifica prenotazione"
                className={styles.close}
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form action={formAction} className={styles.grid} noValidate>
              <label className={styles.field}>
                <span>Nome</span>
                <input
                  defaultValue={reservation.customerName}
                  maxLength={120}
                  name="customerName"
                  required
                />
                <FieldError field="customerName" state={state} />
              </label>

              <label className={styles.field}>
                <span>Telefono</span>
                <input
                  defaultValue={reservation.customerPhone}
                  maxLength={40}
                  name="customerPhone"
                  required
                  type="tel"
                />
                <FieldError field="customerPhone" state={state} />
              </label>

              <label className={styles.field}>
                <span>Data</span>
                <input
                  defaultValue={reservation.reservationDate}
                  name="reservationDate"
                  required
                  type="date"
                />
                <FieldError field="reservationDate" state={state} />
              </label>

              <label className={styles.field}>
                <span>Orario</span>
                <select
                  defaultValue={reservation.reservationTime.slice(0, 5)}
                  name="reservationTime"
                  required
                >
                  {reservationTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <FieldError field="reservationTime" state={state} />
              </label>

              <label className={styles.field}>
                <span>Persone</span>
                <select
                  defaultValue={String(reservation.partySize)}
                  name="partySize"
                  required
                >
                  {Array.from({ length: 8 }, (_, index) => index + 1).map(
                    (partySize) => (
                      <option key={partySize} value={partySize}>
                        {partySize}
                      </option>
                    ),
                  )}
                </select>
                <FieldError field="partySize" state={state} />
              </label>

              <label className={styles.fullField}>
                <span>Note (facoltative)</span>
                <textarea
                  defaultValue={reservation.customerNotes ?? ""}
                  maxLength={1000}
                  name="customerNotes"
                  rows={4}
                />
                <FieldError field="customerNotes" state={state} />
              </label>

              {state.message && (
                <p className={styles.message} role="alert">
                  {state.message}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  className="button button-secondary"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <SaveButton />
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
