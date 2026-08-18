import { isValidServiceDate } from "./date";
import type {
  DailyMenuFormErrors,
  DailyMenuFormState,
  DailyMenuFormValues,
} from "./types";

const maximumTitleLength = 160;
const maximumNotesLength = 2_000;
const genericErrorMessage = "Impossibile creare il menu. Riprova.";

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getDailyMenuFormValues(
  formData: FormData,
): DailyMenuFormValues {
  return {
    serviceDate: getTextValue(formData, "serviceDate").trim(),
    title: getTextValue(formData, "title").trim(),
    notes: getTextValue(formData, "notes").trim(),
  };
}

export function validateDailyMenuFormValues(values: DailyMenuFormValues) {
  const errors: DailyMenuFormErrors = {};

  if (!isValidServiceDate(values.serviceDate)) {
    errors.serviceDate = "Inserisci una data valida.";
  }

  if (values.title.length > maximumTitleLength) {
    errors.title = "Inserisci un titolo valido.";
  }

  if (values.notes.length > maximumNotesLength) {
    errors.notes = genericErrorMessage;
  }

  return errors;
}

export function dailyMenuFormErrorState(
  values: DailyMenuFormValues,
  errors: DailyMenuFormErrors = {},
  message: string | null = null,
): DailyMenuFormState {
  return { errors, message, values };
}
