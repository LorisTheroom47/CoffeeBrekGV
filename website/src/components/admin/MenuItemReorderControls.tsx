"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  reorderMenuItemAction,
  type ReorderMenuItemState,
} from "@/app/admin/(protected)/reorder-menu-item";

type ReorderDirection = "up" | "down";

type ReorderButtonProps = Readonly<{
  direction: ReorderDirection;
  disabled: boolean;
  itemName: string;
}>;

type MenuItemReorderControlsProps = Readonly<{
  canMoveDown: boolean;
  canMoveUp: boolean;
  itemId: string;
  itemName: string;
}>;

const initialState: ReorderMenuItemState = {
  message: null,
};

function ReorderButton({
  direction,
  disabled,
  itemName,
}: ReorderButtonProps) {
  const { data, pending } = useFormStatus();
  const isPressedButton = data?.get("direction") === direction;
  const label = direction === "up" ? "Sposta su" : "Sposta giù";
  const ariaDirection = direction === "up" ? "verso l’alto" : "verso il basso";

  return (
    <button
      aria-label={`Sposta ${itemName} ${ariaDirection}`}
      className="admin-table-action"
      disabled={disabled || pending}
      name="direction"
      type="submit"
      value={direction}
    >
      {pending && isPressedButton ? "Spostamento…" : label}
    </button>
  );
}

export default function MenuItemReorderControls({
  canMoveDown,
  canMoveUp,
  itemId,
  itemName,
}: MenuItemReorderControlsProps) {
  const reorderAction = reorderMenuItemAction.bind(null, itemId);
  const [state, formAction] = useActionState(reorderAction, initialState);

  return (
    <div className="admin-reorder-controls">
      <form action={formAction} className="admin-reorder-form">
        <ReorderButton
          direction="up"
          disabled={!canMoveUp}
          itemName={itemName}
        />
        <ReorderButton
          direction="down"
          disabled={!canMoveDown}
          itemName={itemName}
        />
      </form>
      {state.message ? (
        <p className="admin-reorder-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
