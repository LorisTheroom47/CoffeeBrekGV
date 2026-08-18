export type MenuItemFormValues = Readonly<{
  name: string;
  description: string;
  categoryId: string;
  price: string;
  available: string;
  allergenIds: string[];
}>;

export type MenuItemFormErrors = Partial<
  Record<
    "name" | "categoryId" | "price" | "available" | "allergenIds",
    string
  >
>;

export type MenuItemFormState = Readonly<{
  message: string | null;
  errors: MenuItemFormErrors;
  values: MenuItemFormValues;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pricePattern = /^\d{1,8}(?:[.,]\d{1,2})?$/;
const maximumPriceInCents = 9_999_999_999;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parsePrice(price: string) {
  if (!pricePattern.test(price)) {
    return null;
  }

  const normalizedPrice = price.replace(",", ".");
  const [integerPart, decimalPart = ""] = normalizedPrice.split(".");
  const priceInCents =
    Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));

  if (
    !Number.isSafeInteger(priceInCents) ||
    priceInCents > maximumPriceInCents
  ) {
    return null;
  }

  const euros = Math.floor(priceInCents / 100);
  const cents = String(priceInCents % 100).padStart(2, "0");
  return `${euros}.${cents}`;
}

export function isValidUuid(value: string) {
  return uuidPattern.test(value);
}

export function getMenuItemFormInput(
  formData: FormData,
): Readonly<{
  values: MenuItemFormValues;
  allergenIdsValid: boolean;
}> {
  const available = getTextValue(formData, "available");
  const rawAllergenIds = formData.getAll("allergenIds");
  const stringAllergenIds = rawAllergenIds.filter(
    (value): value is string => typeof value === "string",
  );
  const allergenIds = [...new Set(stringAllergenIds)];

  return {
    values: {
      name: getTextValue(formData, "name").trim(),
      description: getTextValue(formData, "description").trim(),
      categoryId: getTextValue(formData, "categoryId").trim(),
      price: getTextValue(formData, "price").trim(),
      available:
        available === "true" || available === "false" ? available : "",
      allergenIds,
    },
    allergenIdsValid:
      rawAllergenIds.length === stringAllergenIds.length &&
      allergenIds.every(isValidUuid),
  };
}

export function validateMenuItemFormValues(
  values: MenuItemFormValues,
  allergenIdsValid: boolean,
) {
  const errors: MenuItemFormErrors = {};
  const parsedPrice = parsePrice(values.price);

  if (values.name.length === 0) {
    errors.name = "Inserisci il nome del piatto.";
  }

  if (!isValidUuid(values.categoryId)) {
    errors.categoryId = "Seleziona una categoria valida.";
  }

  if (parsedPrice === null) {
    errors.price = "Inserisci un prezzo valido con massimo due decimali.";
  }

  if (values.available !== "true" && values.available !== "false") {
    errors.available = "Seleziona uno stato di disponibilità valido.";
  }

  if (!allergenIdsValid || values.allergenIds.some((id) => !isValidUuid(id))) {
    errors.allergenIds = "La selezione degli allergeni non è valida.";
  }

  return { errors, parsedPrice };
}

export function menuItemFormErrorState(
  values: MenuItemFormValues,
  errors: MenuItemFormErrors = {},
  message: string | null = null,
): MenuItemFormState {
  return { message, errors, values };
}

export function formatPriceForInput(price: number | string) {
  const numericPrice = typeof price === "number" ? price : Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    throw new Error("Prezzo del piatto non valido.");
  }

  return numericPrice.toFixed(2).replace(".", ",");
}
