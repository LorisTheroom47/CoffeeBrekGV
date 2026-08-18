"use client";

import { useActionState } from "react";
import type {
  CategoryFormState,
  CategoryFormValues,
} from "@/lib/menu/category-form";

type CategoryFormAction = (
  state: CategoryFormState,
  formData: FormData,
) => Promise<CategoryFormState>;

type CategoryFormProps = Readonly<{
  action: CategoryFormAction;
  initialValues: CategoryFormValues;
  submitLabel: string;
}>;

export default function CategoryForm({
  action,
  initialValues,
  submitLabel,
}: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    message: null,
    errors: {},
    values: initialValues,
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
          <label htmlFor="category-name">Nome</label>
          <input
            aria-describedby={
              state.errors.name ? "category-name-error" : undefined
            }
            aria-invalid={Boolean(state.errors.name)}
            defaultValue={state.values.name}
            disabled={isPending}
            id="category-name"
            maxLength={120}
            name="name"
            required
            type="text"
          />
          {state.errors.name ? (
            <p className="admin-form-field-error" id="category-name-error">
              {state.errors.name}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="category-slug">Slug</label>
          <input
            aria-describedby={
              state.errors.slug ? "category-slug-error" : "category-slug-hint"
            }
            aria-invalid={Boolean(state.errors.slug)}
            autoCapitalize="none"
            autoCorrect="off"
            defaultValue={state.values.slug}
            disabled={isPending}
            id="category-slug"
            maxLength={80}
            name="slug"
            required
            spellCheck={false}
            type="text"
          />
          {state.errors.slug ? (
            <p className="admin-form-field-error" id="category-slug-error">
              {state.errors.slug}
            </p>
          ) : (
            <p className="admin-form-hint" id="category-slug-hint">
              Usa lettere minuscole, numeri e trattini. Il valore viene
              normalizzato in minuscolo.
            </p>
          )}
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
