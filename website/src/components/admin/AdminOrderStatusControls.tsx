"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateOrderStatusAction,
  type UpdateOrderStatusState,
} from "@/app/admin/(protected)/ordini/[id]/actions";
import {
  getAdminOrderStatusPresentation,
  getAllowedAdminOrderTransitions,
  isAdminOrderStatus,
  type AdminOrderTargetStatus,
} from "@/lib/orders/admin-types";

type AdminOrderStatusControlsProps = Readonly<{
  currentStatus: string;
  fulfillmentType: string;
  orderId: string;
}>;

type StatusActionButtonProps = Readonly<{
  targetStatus: AdminOrderTargetStatus;
}>;

type CancellationControlProps = Readonly<{
  onClick: () => void;
}>;

const initialState: UpdateOrderStatusState = { message: null };

const actionLabels: Readonly<Record<AdminOrderTargetStatus, string>> = {
  confirmed: "Conferma",
  preparing: "Inizia preparazione",
  ready: "Segna come pronto",
  out_for_delivery: "Metti in consegna",
  completed: "Completa ordine",
  cancelled: "Conferma annullamento",
};

function StatusActionButton({ targetStatus }: StatusActionButtonProps) {
  const { data, pending } = useFormStatus();
  const isCurrentAction = data?.get("targetStatus") === targetStatus;

  return (
    <button
      className={
        targetStatus === "cancelled"
          ? "button admin-button-danger"
          : "button button-primary"
      }
      disabled={pending}
      name="targetStatus"
      type="submit"
      value={targetStatus}
    >
      {pending && isCurrentAction ? "Aggiornamento…" : actionLabels[targetStatus]}
    </button>
  );
}

function CancellationTrigger({ onClick }: CancellationControlProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className="button admin-button-danger"
      disabled={pending}
      onClick={onClick}
      type="button"
    >
      Annulla ordine
    </button>
  );
}

function CancellationDismiss({ onClick }: CancellationControlProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button-secondary"
      disabled={pending}
      onClick={onClick}
      type="button"
    >
      Mantieni ordine
    </button>
  );
}

export default function AdminOrderStatusControls({
  currentStatus,
  fulfillmentType,
  orderId,
}: AdminOrderStatusControlsProps) {
  const [showCancellationConfirmation, setShowCancellationConfirmation] =
    useState(false);
  const updateAction = updateOrderStatusAction.bind(null, orderId);
  const [state, formAction] = useActionState(updateAction, initialState);

  if (!isAdminOrderStatus(currentStatus)) return null;

  const status = getAdminOrderStatusPresentation(currentStatus);
  const allowedTransitions = getAllowedAdminOrderTransitions(
    currentStatus,
    fulfillmentType,
  );
  const regularTransitions = allowedTransitions.filter(
    (targetStatus) => targetStatus !== "cancelled",
  );
  const canCancel = allowedTransitions.includes("cancelled");

  return (
    <section
      className="admin-order-status-card"
      aria-labelledby="manage-status-title"
    >
      <div>
        <p className="eyebrow">Gestione ordine</p>
        <h2 id="manage-status-title">Gestisci stato</h2>
        <p className="admin-order-current-status">
          Stato attuale: {" "}
          <span className={`admin-status ${status.className}`}>
            {status.label}
          </span>
        </p>
      </div>

      {allowedTransitions.length === 0 ? (
        <p className="admin-order-terminal-status">
          Non sono disponibili ulteriori transizioni di stato.
        </p>
      ) : (
        <form action={formAction} className="admin-order-status-form">
          <input
            name="expectedCurrentStatus"
            type="hidden"
            value={currentStatus}
          />
          <div className="admin-order-status-actions">
            {regularTransitions.map((targetStatus) => (
              <StatusActionButton
                key={targetStatus}
                targetStatus={targetStatus}
              />
            ))}

            {canCancel && !showCancellationConfirmation && (
              <CancellationTrigger
                onClick={() => setShowCancellationConfirmation(true)}
              />
            )}
          </div>

          {canCancel && showCancellationConfirmation && (
            <div
              className="admin-order-cancel-confirmation"
              role="group"
              aria-labelledby="cancel-order-title"
            >
              <h3 id="cancel-order-title">Confermare l’annullamento?</h3>
              <p>L’ordine non potrà più avanzare ad altri stati.</p>
              <div>
                <StatusActionButton targetStatus="cancelled" />
                <CancellationDismiss
                  onClick={() => setShowCancellationConfirmation(false)}
                />
              </div>
            </div>
          )}

          {state.message && (
            <p className="admin-form-message" role="alert">
              {state.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
