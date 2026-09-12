"use client";

import { useActionState } from "react";
import type {
  ProductOptionGroupFormState,
  ProductOptionGroupFormValues,
} from "@/lib/menu/product-option-form";

type ProductOptionGroupFormAction = (
  state: ProductOptionGroupFormState,
  formData: FormData,
) => Promise<ProductOptionGroupFormState>;

type ProductOptionGroupFormProps = Readonly<{
  action: ProductOptionGroupFormAction;
  formId: string;
  initialValues: ProductOptionGroupFormValues;
  submitLabel: string;
}>;

export default function ProductOptionGroupForm({
  action,
  formId,
  initialValues,
  submitLabel,
}: ProductOptionGroupFormProps) {
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
          <label htmlFor={`${formId}-name`}>Nome gruppo</label>
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

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor={`${formId}-selection-type`}>Tipo di scelta</label>
          <select
            aria-invalid={Boolean(state.errors.selectionType)}
            defaultValue={state.values.selectionType}
            disabled={isPending}
            id={`${formId}-selection-type`}
            name="selectionType"
            required
          >
            <option value="MULTIPLE_OPTIONAL">
              Scelta multipla facoltativa
            </option>
            <option value="SINGLE_REQUIRED">
              Scelta singola obbligatoria
            </option>
          </select>
          {state.errors.selectionType ? (
            <p className="admin-form-field-error">
              {state.errors.selectionType}
            </p>
          ) : (
            <div className="admin-form-hint">
              <p>
                <strong>Scelta multipla:</strong> il cliente può scegliere
                nessuna, una o più opzioni.
              </p>
              <p>
                <strong>Scelta singola obbligatoria:</strong> il cliente deve
                scegliere esattamente una opzione.
              </p>
            </div>
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

        <div className="admin-form-field">
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
