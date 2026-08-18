"use client";

import { useActionState } from "react";
import type { DeleteMenuItemState } from "@/app/admin/(protected)/piatti/[id]/elimina/actions";

type DeleteMenuItemAction = (
  state: DeleteMenuItemState,
  formData: FormData,
) => Promise<DeleteMenuItemState>;

type DeleteMenuItemFormProps = Readonly<{
  action: DeleteMenuItemAction;
}>;

const initialState: DeleteMenuItemState = {
  message: null,
};

export default function DeleteMenuItemForm({
  action,
}: DeleteMenuItemFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="admin-delete-form">
      {state.message ? (
        <p className="admin-form-message" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="button admin-button-danger"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Eliminazione…" : "Elimina definitivamente"}
      </button>
    </form>
  );
}
