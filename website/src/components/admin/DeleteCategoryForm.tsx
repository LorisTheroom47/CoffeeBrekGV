"use client";

import { useActionState } from "react";
import type { DeleteCategoryState } from "@/app/admin/(protected)/categorie/[id]/elimina/actions";

type DeleteCategoryAction = (
  state: DeleteCategoryState,
  formData: FormData,
) => Promise<DeleteCategoryState>;

type DeleteCategoryFormProps = Readonly<{
  action: DeleteCategoryAction;
}>;

const initialState: DeleteCategoryState = { message: null };

export default function DeleteCategoryForm({
  action,
}: DeleteCategoryFormProps) {
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
