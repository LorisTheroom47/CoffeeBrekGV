"use client";

import { useActionState } from "react";
import type {
  MenuItemFormState,
  MenuItemFormValues,
} from "@/lib/menu/menu-item-form";
import type { AllergenOption, MenuCategoryOption } from "@/lib/menu";

type MenuItemFormAction = (
  state: MenuItemFormState,
  formData: FormData,
) => Promise<MenuItemFormState>;

type MenuItemFormProps = Readonly<{
  action: MenuItemFormAction;
  allergens: AllergenOption[];
  availabilityLabel: string;
  categories: MenuCategoryOption[];
  initialValues: MenuItemFormValues;
  submitLabel: string;
}>;

export default function MenuItemForm({
  action,
  allergens,
  availabilityLabel,
  categories,
  initialValues,
  submitLabel,
}: MenuItemFormProps) {
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
          <label htmlFor="menu-item-name">Nome del piatto</label>
          <input
            aria-describedby={state.errors.name ? "menu-item-name-error" : undefined}
            aria-invalid={Boolean(state.errors.name)}
            defaultValue={state.values.name}
            disabled={isPending}
            id="menu-item-name"
            name="name"
            required
            type="text"
          />
          {state.errors.name ? (
            <p className="admin-form-field-error" id="menu-item-name-error">
              {state.errors.name}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="menu-item-description">Descrizione</label>
          <textarea
            defaultValue={state.values.description}
            disabled={isPending}
            id="menu-item-description"
            name="description"
            rows={4}
          />
          <p className="admin-form-hint">Campo facoltativo.</p>
        </div>

        <div className="admin-form-field">
          <label htmlFor="menu-item-category">Categoria</label>
          <select
            aria-describedby={
              state.errors.categoryId ? "menu-item-category-error" : undefined
            }
            aria-invalid={Boolean(state.errors.categoryId)}
            defaultValue={state.values.categoryId}
            disabled={isPending}
            id="menu-item-category"
            name="categoryId"
            required
          >
            <option value="">Seleziona una categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {state.errors.categoryId ? (
            <p className="admin-form-field-error" id="menu-item-category-error">
              {state.errors.categoryId}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field">
          <label htmlFor="menu-item-price">Prezzo (€)</label>
          <input
            aria-describedby={
              state.errors.price
                ? "menu-item-price-error"
                : "menu-item-price-hint"
            }
            aria-invalid={Boolean(state.errors.price)}
            defaultValue={state.values.price}
            disabled={isPending}
            id="menu-item-price"
            inputMode="decimal"
            name="price"
            pattern="[0-9]+([,.][0-9]{1,2})?"
            placeholder="es. 9,50"
            required
            type="text"
          />
          {state.errors.price ? (
            <p className="admin-form-field-error" id="menu-item-price-error">
              {state.errors.price}
            </p>
          ) : (
            <p className="admin-form-hint" id="menu-item-price-hint">
              Usa la virgola o il punto, con massimo due decimali.
            </p>
          )}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="menu-item-available">{availabilityLabel}</label>
          <select
            aria-describedby={
              state.errors.available
                ? "menu-item-available-error"
                : undefined
            }
            aria-invalid={Boolean(state.errors.available)}
            defaultValue={state.values.available}
            disabled={isPending}
            id="menu-item-available"
            name="available"
            required
          >
            <option value="true">Disponibile</option>
            <option value="false">Terminato</option>
          </select>
          {state.errors.available ? (
            <p className="admin-form-field-error" id="menu-item-available-error">
              {state.errors.available}
            </p>
          ) : null}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="menu-item-orderable">Ordinabile online</label>
          <select
            aria-describedby={
              state.errors.orderable
                ? "menu-item-orderable-error"
                : "menu-item-orderable-hint"
            }
            aria-invalid={Boolean(state.errors.orderable)}
            defaultValue={state.values.orderable}
            disabled={isPending}
            id="menu-item-orderable"
            name="orderable"
            required
          >
            <option value="true">Ordinabile</option>
            <option value="false">Non ordinabile</option>
          </select>
          {state.errors.orderable ? (
            <p className="admin-form-field-error" id="menu-item-orderable-error">
              {state.errors.orderable}
            </p>
          ) : (
            <p className="admin-form-hint" id="menu-item-orderable-hint">
              Il piatto resta visibile nel menu anche quando non è ordinabile.
            </p>
          )}
        </div>

        <div className="admin-form-field admin-form-field-full">
          <label htmlFor="menu-item-customizable">Personalizzabile</label>
          <select
            aria-describedby={
              state.errors.customizable
                ? "menu-item-customizable-error"
                : "menu-item-customizable-hint"
            }
            aria-invalid={Boolean(state.errors.customizable)}
            defaultValue={state.values.customizable}
            disabled={isPending}
            id="menu-item-customizable"
            name="customizable"
            required
          >
            <option value="false">Non personalizzabile</option>
            <option value="true">Personalizzabile</option>
          </select>
          {state.errors.customizable ? (
            <p className="admin-form-field-error" id="menu-item-customizable-error">
              {state.errors.customizable}
            </p>
          ) : (
            <p className="admin-form-hint" id="menu-item-customizable-hint">
              Abilita gli extra configurati per Panini, Piadine e Prodotti
              senza glutine.
            </p>
          )}
        </div>

        <fieldset
          aria-describedby={
            state.errors.allergenIds ? "menu-item-allergens-error" : undefined
          }
          className="admin-allergen-fieldset admin-form-field-full"
        >
          <legend>Allergeni</legend>
          {allergens.length === 0 ? (
            <p className="admin-form-hint">Nessun allergene disponibile.</p>
          ) : (
            <div className="admin-allergen-list">
              {allergens.map((allergen) => (
                <label className="admin-allergen-option" key={allergen.id}>
                  <input
                    defaultChecked={state.values.allergenIds.includes(
                      allergen.id,
                    )}
                    disabled={isPending}
                    name="allergenIds"
                    type="checkbox"
                    value={allergen.id}
                  />
                  <span>
                    {allergen.code}. {allergen.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          {state.errors.allergenIds ? (
            <p className="admin-form-field-error" id="menu-item-allergens-error">
              {state.errors.allergenIds}
            </p>
          ) : null}
        </fieldset>
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
