"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  reorderCategoryAction,
  type ReorderCategoryState,
} from "@/app/admin/(protected)/categorie/reorder-category";

type ReorderDirection = "up" | "down";

type ReorderButtonProps = Readonly<{
  categoryName: string;
  direction: ReorderDirection;
  disabled: boolean;
}>;

type CategoryReorderControlsProps = Readonly<{
  canMoveDown: boolean;
  canMoveUp: boolean;
  categoryId: string;
  categoryName: string;
}>;

const initialState: ReorderCategoryState = { message: null };

function ReorderButton({
  categoryName,
  direction,
  disabled,
}: ReorderButtonProps) {
  const { data, pending } = useFormStatus();
  const isPressedButton = data?.get("direction") === direction;
  const label = direction === "up" ? "Sposta su" : "Sposta giù";
  const ariaDirection = direction === "up" ? "verso l’alto" : "verso il basso";

  return (
    <button
      aria-label={`Sposta ${categoryName} ${ariaDirection}`}
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

export default function CategoryReorderControls({
  canMoveDown,
  canMoveUp,
  categoryId,
  categoryName,
}: CategoryReorderControlsProps) {
  const reorderAction = reorderCategoryAction.bind(null, categoryId);
  const [state, formAction] = useActionState(reorderAction, initialState);

  return (
    <div className="admin-reorder-controls">
      <form action={formAction} className="admin-reorder-form">
        <ReorderButton
          categoryName={categoryName}
          direction="up"
          disabled={!canMoveUp}
        />
        <ReorderButton
          categoryName={categoryName}
          direction="down"
          disabled={!canMoveDown}
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
