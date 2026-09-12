"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteTableReservationAction,
  type DeleteReservationState,
} from "@/app/admin/(protected)/prenotazioni/actions";

type AdminReservationDeleteControlProps = Readonly<{
  reservationId: string;
  reservationNumber: string;
}>;

const initialState: DeleteReservationState = { message: null };

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-table-action admin-table-action-danger" disabled={pending} type="submit">
      {pending ? "Eliminazione…" : "Conferma"}
    </button>
  );
}

export default function AdminReservationDeleteControl({
  reservationId,
  reservationNumber,
}: AdminReservationDeleteControlProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const action = deleteTableReservationAction.bind(null, reservationId);
  const [state, formAction] = useActionState(action, initialState);

  if (!showConfirmation) {
    return (
      <button
        className="admin-table-action admin-table-action-danger"
        onClick={() => setShowConfirmation(true)}
        type="button"
      >
        Elimina
      </button>
    );
  }

  return (
    <div className="admin-reservation-delete" role="group" aria-label={`Conferma eliminazione prenotazione n. ${reservationNumber}`}>
      <p><strong>Vuoi eliminare definitivamente la prenotazione n. {reservationNumber}?</strong></p>
      <form action={formAction}>
        <div className="admin-table-actions">
          <DeleteSubmitButton />
          <button className="admin-table-action" onClick={() => setShowConfirmation(false)} type="button">
            Annulla
          </button>
        </div>
        {state.message && <p className="admin-reorder-error" role="alert">{state.message}</p>}
      </form>
    </div>
  );
}
