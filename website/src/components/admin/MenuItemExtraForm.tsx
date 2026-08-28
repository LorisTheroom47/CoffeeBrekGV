"use client";

import { useActionState } from "react";
import type {
  MenuItemExtraFormState,
  MenuItemExtraFormValues,
} from "@/lib/menu/menu-extra-form";

type ExtraFormAction = (
  state: MenuItemExtraFormState,
  formData: FormData,
) => Promise<MenuItemExtraFormState>;

type MenuItemExtraFormProps = Readonly<{
  action: ExtraFormAction;
  initialValues: MenuItemExtraFormValues;
  submitLabel: string;
}>;

export default function MenuItemExtraForm({
  action,
  initialValues,
  submitLabel,
}: MenuItemExtraFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    values: initialValues,
    errors: {},
    message: null,
  });

  return (
    <form action={formAction} className="admin-form" noValidate>
      {state.message && (
        <p className="admin-form-message" role="alert">{state.message}</p>
      )}
      <div className="admin-form-grid">
        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="extra-name">Nome</label>
          <input
            id="extra-name"
            name="name"
            maxLength={120}
            required
            disabled={isPending}
            defaultValue={state.values.name}
            aria-invalid={Boolean(state.errors.name)}
          />
          {state.errors.name && <p className="admin-form-field-error">{state.errors.name}</p>}
        </div>
        <div className="admin-form-field">
          <label htmlFor="extra-group">Gruppo</label>
          <select
            id="extra-group"
            name="groupCode"
            required
            disabled={isPending}
            defaultValue={state.values.groupCode}
            aria-invalid={Boolean(state.errors.groupCode)}
          >
            <option value="FORMAGGIO">Formaggio</option>
            <option value="VERDURA">Verdura</option>
            <option value="SALSA">Salsa</option>
          </select>
          {state.errors.groupCode && <p className="admin-form-field-error">{state.errors.groupCode}</p>}
        </div>
        <div className="admin-form-field">
          <label htmlFor="extra-price">Prezzo extra (€)</label>
          <input
            id="extra-price"
            name="price"
            inputMode="decimal"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            required
            disabled={isPending}
            defaultValue={state.values.price}
            aria-invalid={Boolean(state.errors.price)}
          />
          {state.errors.price && <p className="admin-form-field-error">{state.errors.price}</p>}
        </div>
        <div className="admin-form-field">
          <label htmlFor="extra-scope">Applicabile a</label>
          <select
            id="extra-scope"
            name="appliesTo"
            required
            disabled={isPending}
            defaultValue={state.values.appliesTo}
            aria-invalid={Boolean(state.errors.appliesTo)}
          >
            <option value="PANINO">Panino</option>
            <option value="PIADINA">Piadina</option>
            <option value="ENTRAMBI">Entrambi</option>
          </select>
          {state.errors.appliesTo && <p className="admin-form-field-error">{state.errors.appliesTo}</p>}
        </div>
        <div className="admin-form-field">
          <label htmlFor="extra-available">Disponibilità</label>
          <select
            id="extra-available"
            name="available"
            required
            disabled={isPending}
            defaultValue={state.values.available}
            aria-invalid={Boolean(state.errors.available)}
          >
            <option value="true">Disponibile</option>
            <option value="false">Non disponibile</option>
          </select>
          {state.errors.available && <p className="admin-form-field-error">{state.errors.available}</p>}
        </div>
        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="extra-display-order">Ordine visualizzazione</label>
          <input
            id="extra-display-order"
            name="displayOrder"
            inputMode="numeric"
            min={0}
            required
            type="number"
            disabled={isPending}
            defaultValue={state.values.displayOrder}
            aria-invalid={Boolean(state.errors.displayOrder)}
          />
          {state.errors.displayOrder && <p className="admin-form-field-error">{state.errors.displayOrder}</p>}
        </div>
      </div>
      <div className="admin-form-actions">
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Salvataggio…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
