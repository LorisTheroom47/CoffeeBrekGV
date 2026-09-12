import type { ProductOptionSelectionType } from "./types";

export type ProductOptionGroupFormValues = Readonly<{
  name: string;
  selectionType: string;
  available: string;
  displayOrder: string;
}>;

export type ProductOptionGroupFormErrors = Partial<
  Record<keyof ProductOptionGroupFormValues, string>
>;

export type ProductOptionGroupFormState = Readonly<{
  values: ProductOptionGroupFormValues;
  errors: ProductOptionGroupFormErrors;
  message: string | null;
}>;

export type ProductOptionFormValues = Readonly<{
  name: string;
  price: string;
  available: string;
  displayOrder: string;
}>;

export type ProductOptionFormErrors = Partial<
  Record<keyof ProductOptionFormValues, string>
>;

export type ProductOptionFormState = Readonly<{
  values: ProductOptionFormValues;
  errors: ProductOptionFormErrors;
  message: string | null;
}>;

export type ProductOptionDeleteState = Readonly<{
  message: string | null;
}>;

const selectionTypes: readonly ProductOptionSelectionType[] = [
  "MULTIPLE_OPTIONAL",
  "SINGLE_REQUIRED",
];
const pricePattern = /^\d{1,8}(?:[.,]\d{1,2})?$/;
const integerPattern = /^\d{1,10}$/;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseDisplayOrder(value: string): number | null {
  if (!integerPattern.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647
    ? parsed
    : null;
}

function parsePrice(value: string): string | null {
  if (!pricePattern.test(value)) return null;

  const normalized = value.replace(",", ".");
  const [euros, decimal = ""] = normalized.split(".");
  const cents = Number(euros) * 100 + Number(decimal.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents > 9_999_999_999) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function validAvailability(value: string): boolean {
  return value === "true" || value === "false";
}

export function getProductOptionGroupFormValues(
  formData: FormData,
): ProductOptionGroupFormValues {
  return {
    name: text(formData, "name"),
    selectionType: text(formData, "selectionType"),
    available: text(formData, "available"),
    displayOrder: text(formData, "displayOrder"),
  };
}

export function validateProductOptionGroupFormValues(
  values: ProductOptionGroupFormValues,
) {
  const errors: ProductOptionGroupFormErrors = {};
  const displayOrder = parseDisplayOrder(values.displayOrder);

  if (values.name.length === 0 || values.name.length > 120) {
    errors.name = "Inserisci un nome valido.";
  }
  if (!selectionTypes.includes(values.selectionType as ProductOptionSelectionType)) {
    errors.selectionType = "Seleziona un tipo valido.";
  }
  if (!validAvailability(values.available)) {
    errors.available = "Seleziona una disponibilità valida.";
  }
  if (displayOrder === null) {
    errors.displayOrder = "Inserisci un ordine intero maggiore o uguale a zero.";
  }

  return {
    errors,
    displayOrder,
    selectionType: selectionTypes.includes(
      values.selectionType as ProductOptionSelectionType,
    )
      ? (values.selectionType as ProductOptionSelectionType)
      : null,
  };
}

export function productOptionGroupFormState(
  values: ProductOptionGroupFormValues,
  errors: ProductOptionGroupFormErrors = {},
  message: string | null = null,
): ProductOptionGroupFormState {
  return { values, errors, message };
}

export function getProductOptionFormValues(
  formData: FormData,
): ProductOptionFormValues {
  return {
    name: text(formData, "name"),
    price: text(formData, "price"),
    available: text(formData, "available"),
    displayOrder: text(formData, "displayOrder"),
  };
}

export function validateProductOptionFormValues(
  values: ProductOptionFormValues,
) {
  const errors: ProductOptionFormErrors = {};
  const price = parsePrice(values.price);
  const displayOrder = parseDisplayOrder(values.displayOrder);

  if (values.name.length === 0 || values.name.length > 120) {
    errors.name = "Inserisci un nome valido.";
  }
  if (price === null) {
    errors.price = "Inserisci un prezzo valido con massimo due decimali.";
  }
  if (!validAvailability(values.available)) {
    errors.available = "Seleziona una disponibilità valida.";
  }
  if (displayOrder === null) {
    errors.displayOrder = "Inserisci un ordine intero maggiore o uguale a zero.";
  }

  return { errors, price, displayOrder };
}

export function productOptionFormState(
  values: ProductOptionFormValues,
  errors: ProductOptionFormErrors = {},
  message: string | null = null,
): ProductOptionFormState {
  return { values, errors, message };
}
