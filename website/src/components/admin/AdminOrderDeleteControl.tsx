"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteOrderAction,
  type DeleteOrderState,
} from "@/app/admin/(orders)/ordini/[id]/actions";

type AdminOrderDeleteControlProps = Readonly<{
  orderId: string;
  orderNumber: string | null;
}>;

const initialState: DeleteOrderState = { message: null };

function DeleteOrderSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button admin-button-danger"
      disabled={pending}
      type="submit"
    >
      {pending ? "Eliminazione…" : "Conferma eliminazione"}
    </button>
  );
}

export default function AdminOrderDeleteControl({
  orderId,
  orderNumber,
}: AdminOrderDeleteControlProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const deleteAction = deleteOrderAction.bind(null, orderId);
  const [state, formAction] = useActionState(deleteAction, initialState);
  const displayedOrderNumber = orderNumber ?? "non disponibile";

  return (
    <section
      className="admin-order-detail-card"
      aria-labelledby="delete-order-title"
    >
      <p className="eyebrow">Operazione definitiva</p>
      <h2 id="delete-order-title">Elimina ordine</h2>
      <p>
        L’ordine e tutte le relative righe verranno eliminati definitivamente.
      </p>

      {!showConfirmation ? (
        <div className="admin-delete-actions">
          <button
            className="button admin-button-danger"
            onClick={() => setShowConfirmation(true)}
            type="button"
          >
            Elimina ordine
          </button>
        </div>
      ) : (
        <div
          className="admin-delete-warning"
          role="group"
          aria-labelledby="delete-order-confirmation"
        >
          <p id="delete-order-confirmation">
            <strong>
              Vuoi eliminare definitivamente l’ordine n. {displayedOrderNumber}?
            </strong>
          </p>
          <p>Questa operazione non può essere annullata.</p>
          <form action={formAction} className="admin-delete-form">
            <div className="admin-delete-actions">
              <DeleteOrderSubmitButton />
              <button
                className="button button-secondary"
                onClick={() => setShowConfirmation(false)}
                type="button"
              >
                Mantieni ordine
              </button>
            </div>
            {state.message && (
              <p className="admin-form-message" role="alert">
                {state.message}
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
