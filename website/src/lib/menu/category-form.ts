export type CategoryFormValues = Readonly<{
  name: string;
  slug: string;
}>;

export type CategoryFormErrors = Partial<
  Record<"name" | "slug", string>
>;

export type CategoryFormState = Readonly<{
  message: string | null;
  errors: CategoryFormErrors;
  values: CategoryFormValues;
}>;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maximumNameLength = 120;
const maximumSlugLength = 80;

function getTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function normalizeCategorySlug(value: string) {
  return value.trim().toLowerCase();
}

export function getCategoryFormValues(
  formData: FormData,
): CategoryFormValues {
  return {
    name: getTextValue(formData, "name").trim(),
    slug: normalizeCategorySlug(getTextValue(formData, "slug")),
  };
}

export function validateCategoryFormValues(values: CategoryFormValues) {
  const errors: CategoryFormErrors = {};

  if (values.name.length === 0 || values.name.length > maximumNameLength) {
    errors.name = "Inserisci un nome valido.";
  }

  if (
    values.slug.length === 0 ||
    values.slug.length > maximumSlugLength ||
    !slugPattern.test(values.slug)
  ) {
    errors.slug = "Inserisci uno slug valido.";
  }

  return errors;
}

export function categoryFormErrorState(
  values: CategoryFormValues,
  errors: CategoryFormErrors = {},
  message: string | null = null,
): CategoryFormState {
  return { message, errors, values };
}
