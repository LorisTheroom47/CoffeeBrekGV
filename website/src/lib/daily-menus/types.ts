export type DailyMenuSummary = Readonly<{
  id: string;
  serviceDate: string;
  status: string;
  title: string | null;
}>;

export type DailyMenuFormValues = Readonly<{
  serviceDate: string;
  title: string;
  notes: string;
}>;

export type DailyMenuFormErrors = Partial<
  Record<keyof DailyMenuFormValues, string>
>;

export type DailyMenuFormState = Readonly<{
  message: string | null;
  errors: DailyMenuFormErrors;
  values: DailyMenuFormValues;
}>;
