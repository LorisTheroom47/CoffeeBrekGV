"use client";

import { useActionState } from "react";
import type {
  DailyMenuFormState,
  DailyMenuFormValues,
} from "@/lib/daily-menus";

type CreateDailyMenuAction = (
  state: DailyMenuFormState,
  formData: FormData,
) => Promise<DailyMenuFormState>;

type CreateDailyMenuFormProps = Readonly<{
  action: CreateDailyMenuAction;
  initialValues: DailyMenuFormValues;
}>;

export default function CreateDailyMenuForm({
  action,
  initialValues,
}: CreateDailyMenuFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    errors: {},
    message: null,
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
          <label htmlFor="daily-menu-service-date">Data del servizio</label>
          <input
            aria-describedby={
              state.errors.serviceDate
                ? "daily-menu-service-date-error"
                : "daily-menu-service-date-hint"
            }
            aria-invalid={Boolean(state.errors.serviceDate)}
            defaultValue={state.values.serviceDate}
            disabled={isPending}
            id="daily-menu-service-date"
            name="serviceDate"
            required
            type="date"
          />
          {state.errors.serviceDate ? (
            <p
              className="admin-form-field-error"
              id="daily-menu-service-date-error"
            >
              {state.errors.serviceDate}
            </p>
          ) : (
            <p className="admin-form-hint" id="daily-menu-service-date-hint">
              La data indica il giorno di servizio nel fuso Europe/Rome.
            </p>
          )}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="daily-menu-title">Titolo (facoltativo)</label>
          <input
            aria-describedby={
              state.errors.title ? "daily-menu-title-error" : undefined
            }
            aria-invalid={Boolean(state.errors.title)}
            defaultValue={state.values.title}
            disabled={isPending}
            id="daily-menu-title"
            maxLength={160}
            name="title"
            type="text"
          />
          {state.errors.title ? (
            <p className="admin-form-field-error" id="daily-menu-title-error">
              {state.errors.title}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="daily-menu-notes">Note (facoltative)</label>
          <textarea
            aria-describedby={
              state.errors.notes ? "daily-menu-notes-error" : undefined
            }
            aria-invalid={Boolean(state.errors.notes)}
            defaultValue={state.values.notes}
            disabled={isPending}
            id="daily-menu-notes"
            maxLength={2000}
            name="notes"
          />
          {state.errors.notes ? (
            <p className="admin-form-field-error" id="daily-menu-notes-error">
              {state.errors.notes}
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
          {isPending ? "Salvataggio…" : "Crea menu"}
        </button>
      </div>
    </form>
  );
}
