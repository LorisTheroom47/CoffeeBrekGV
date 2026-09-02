import type { MenuItemExtraGroup, MenuItemExtraScope } from "./types";

export type MenuItemExtraFormValues = Readonly<{
  name: string;
  groupCode: string;
  price: string;
  appliesTo: string;
  appliesToGlutenFree: string;
  available: string;
  displayOrder: string;
}>;

export type MenuItemExtraFormErrors = Partial<
  Record<keyof MenuItemExtraFormValues, string>
>;

export type MenuItemExtraFormState = Readonly<{
  message: string | null;
  errors: MenuItemExtraFormErrors;
  values: MenuItemExtraFormValues;
}>;

const groups: readonly MenuItemExtraGroup[] = [
  "FORMAGGIO",
  "VERDURA",
  "SALSA",
];
const scopes: readonly MenuItemExtraScope[] = [
  "PANINO",
  "PIADINA",
  "ENTRAMBI",
];
const pricePattern = /^\d{1,8}(?:[.,]\d{1,2})?$/;
const integerPattern = /^\d{1,10}$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getMenuItemExtraFormValues(
  formData: FormData,
): MenuItemExtraFormValues {
  return {
    name: text(formData, "name"),
    groupCode: text(formData, "groupCode"),
    price: text(formData, "price"),
    appliesTo: text(formData, "appliesTo"),
    appliesToGlutenFree: text(formData, "appliesToGlutenFree"),
    available: text(formData, "available"),
    displayOrder: text(formData, "displayOrder"),
  };
}

export function validateMenuItemExtraFormValues(
  values: MenuItemExtraFormValues,
) {
  const errors: MenuItemExtraFormErrors = {};
  let parsedPrice: string | null = null;
  let parsedDisplayOrder: number | null = null;

  if (values.name.length === 0 || values.name.length > 120) {
    errors.name = "Inserisci un nome valido.";
  }

  if (!groups.includes(values.groupCode as MenuItemExtraGroup)) {
    errors.groupCode = "Seleziona un gruppo valido.";
  }

  if (!scopes.includes(values.appliesTo as MenuItemExtraScope)) {
    errors.appliesTo = "Seleziona un ambito valido.";
  }

  if (
    values.appliesToGlutenFree !== "true" &&
    values.appliesToGlutenFree !== "false"
  ) {
    errors.appliesToGlutenFree =
      "Seleziona se l’extra è disponibile per i prodotti senza glutine.";
  }

  if (values.available !== "true" && values.available !== "false") {
    errors.available = "Seleziona una disponibilità valida.";
  }

  if (pricePattern.test(values.price)) {
    const normalized = values.price.replace(",", ".");
    const [euros, decimal = ""] = normalized.split(".");
    const cents = Number(euros) * 100 + Number(decimal.padEnd(2, "0"));

    if (Number.isSafeInteger(cents) && cents <= 9_999_999_999) {
      parsedPrice = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
    }
  }

  if (parsedPrice === null) {
    errors.price = "Inserisci un prezzo valido con massimo due decimali.";
  }

  if (integerPattern.test(values.displayOrder)) {
    const numericOrder = Number(values.displayOrder);
    if (
      Number.isSafeInteger(numericOrder) &&
      numericOrder >= 0 &&
      numericOrder <= 2_147_483_647
    ) {
      parsedDisplayOrder = numericOrder;
    }
  }

  if (parsedDisplayOrder === null) {
    errors.displayOrder = "Inserisci un ordine intero maggiore o uguale a zero.";
  }

  return { errors, parsedPrice, parsedDisplayOrder };
}

export function menuItemExtraFormState(
  values: MenuItemExtraFormValues,
  errors: MenuItemExtraFormErrors = {},
  message: string | null = null,
): MenuItemExtraFormState {
  return { values, errors, message };
}
