"use client";

import { useActionState } from "react";
import type { DeleteExtraState } from "@/app/admin/(protected)/extra/[id]/elimina/actions";

type DeleteExtraFormProps = Readonly<{
  action: (
    state: DeleteExtraState,
    formData: FormData,
  ) => Promise<DeleteExtraState>;
}>;

export default function DeleteExtraForm({ action }: DeleteExtraFormProps) {
  const [state, formAction, isPending] = useActionState(action, { message: null });

  return (
    <form action={formAction} className="admin-delete-form">
      {state.message && <p className="admin-form-message" role="alert">{state.message}</p>}
      <button className="button admin-button-danger" disabled={isPending} type="submit">
        {isPending ? "Eliminazione…" : "Elimina definitivamente"}
      </button>
    </form>
  );
}
