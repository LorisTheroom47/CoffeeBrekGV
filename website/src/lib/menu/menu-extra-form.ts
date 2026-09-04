import type { MenuItemExtraGroup, MenuItemExtraScope } from "./types";

export type MenuItemExtraFormValues = Readonly<{
  name: string;
  groupCode: string;
  price: string;
  appliesToPanini: string;
  appliesToPiadine: string;
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
const pricePattern = /^\d{1,8}(?:[.,]\d{1,2})?$/;
const integerPattern = /^\d{1,10}$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checkbox(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value === null) return "false";
  return value === "true" ? "true" : "";
}

export function getMenuItemExtraFormValues(
  formData: FormData,
): MenuItemExtraFormValues {
  return {
    name: text(formData, "name"),
    groupCode: text(formData, "groupCode"),
    price: text(formData, "price"),
    appliesToPanini: checkbox(formData, "appliesToPanini"),
    appliesToPiadine: checkbox(formData, "appliesToPiadine"),
    appliesToGlutenFree: checkbox(formData, "appliesToGlutenFree"),
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
  let parsedAppliesTo: MenuItemExtraScope | null = null;

  if (values.name.length === 0 || values.name.length > 120) {
    errors.name = "Inserisci un nome valido.";
  }

  if (!groups.includes(values.groupCode as MenuItemExtraGroup)) {
    errors.groupCode = "Seleziona un gruppo valido.";
  }

  const applicabilityValues = [
    values.appliesToPanini,
    values.appliesToPiadine,
    values.appliesToGlutenFree,
  ];

  if (applicabilityValues.some((value) => !["true", "false"].includes(value))) {
    errors.appliesToPanini = "Seleziona applicabilità valide.";
  } else if (
    values.appliesToPanini !== "true" &&
    values.appliesToPiadine !== "true"
  ) {
    errors.appliesToPanini =
      "Seleziona almeno Panini o Piadine per mantenere la compatibilità attuale.";
  } else {
    parsedAppliesTo =
      values.appliesToPanini === "true" && values.appliesToPiadine === "true"
        ? "ENTRAMBI"
        : values.appliesToPanini === "true"
          ? "PANINO"
          : "PIADINA";
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

  return { errors, parsedPrice, parsedDisplayOrder, parsedAppliesTo };
}

export function menuItemExtraFormState(
  values: MenuItemExtraFormValues,
  errors: MenuItemExtraFormErrors = {},
  message: string | null = null,
): MenuItemExtraFormState {
  return { values, errors, message };
}
