"use client";

import { useActionState } from "react";
import type {
  ProductOptionFormState,
  ProductOptionFormValues,
} from "@/lib/menu/product-option-form";

type ProductOptionFormAction = (
  state: ProductOptionFormState,
  formData: FormData,
) => Promise<ProductOptionFormState>;

type ProductOptionFormProps = Readonly<{
  action: ProductOptionFormAction;
  formId: string;
  initialValues: ProductOptionFormValues;
  submitLabel: string;
}>;

export default function ProductOptionForm({
  action,
  formId,
  initialValues,
  submitLabel,
}: ProductOptionFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    values: initialValues,
    errors: {},
    message: null,
  });

  return (
    <form action={formAction} className="admin-form" noValidate>
      {state.message ? (
        <p className="admin-form-message" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="admin-form-grid">
        <div className="admin-form-field admin-form-field-full">
          <label htmlFor={`${formId}-name`}>Nome opzione</label>
          <input
            aria-invalid={Boolean(state.errors.name)}
            defaultValue={state.values.name}
            disabled={isPending}
            id={`${formId}-name`}
            maxLength={120}
            name="name"
            required
          />
          {state.errors.name ? (
            <p className="admin-form-field-error">{state.errors.name}</p>
          ) : null}
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${formId}-price`}>Prezzo extra (€)</label>
          <input
            aria-invalid={Boolean(state.errors.price)}
            defaultValue={state.values.price}
            disabled={isPending}
            id={`${formId}-price`}
            inputMode="decimal"
            min="0"
            name="price"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            required
            step="0.01"
            type="number"
          />
          {state.errors.price ? (
            <p className="admin-form-field-error">{state.errors.price}</p>
          ) : (
            <p className="admin-form-hint">Il valore 0 è consentito.</p>
          )}
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${formId}-available`}>Disponibilità</label>
          <select
            aria-invalid={Boolean(state.errors.available)}
            defaultValue={state.values.available}
            disabled={isPending}
            id={`${formId}-available`}
            name="available"
            required
          >
            <option value="true">Disponibile</option>
            <option value="false">Non disponibile</option>
          </select>
          {state.errors.available ? (
            <p className="admin-form-field-error">
              {state.errors.available}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor={`${formId}-display-order`}>
            Ordine visualizzazione
          </label>
          <input
            aria-invalid={Boolean(state.errors.displayOrder)}
            defaultValue={state.values.displayOrder}
            disabled={isPending}
            id={`${formId}-display-order`}
            inputMode="numeric"
            min={0}
            name="displayOrder"
            required
            type="number"
          />
          {state.errors.displayOrder ? (
            <p className="admin-form-field-error">
              {state.errors.displayOrder}
            </p>
          ) : null}
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          className="button button-primary"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvataggio…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
