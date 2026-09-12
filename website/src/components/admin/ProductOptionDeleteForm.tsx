"use client";

import { useActionState } from "react";
import type { ProductOptionDeleteState } from "@/lib/menu/product-option-form";

type ProductOptionDeleteAction = (
  state: ProductOptionDeleteState,
  formData: FormData,
) => Promise<ProductOptionDeleteState>;

type ProductOptionDeleteFormProps = Readonly<{
  action: ProductOptionDeleteAction;
  confirmationMessage: string;
  label: string;
}>;

export default function ProductOptionDeleteForm({
  action,
  confirmationMessage,
  label,
}: ProductOptionDeleteFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    message: null,
  });

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmationMessage)) event.preventDefault();
      }}
    >
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
        {isPending ? "Eliminazione…" : label}
      </button>
    </form>
  );
}
