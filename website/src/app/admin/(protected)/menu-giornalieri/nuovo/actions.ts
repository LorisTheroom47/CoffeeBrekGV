"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  dailyMenuFormErrorState,
  getDailyMenuFormValues,
  type DailyMenuFormState,
  validateDailyMenuFormValues,
} from "@/lib/daily-menus";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const genericErrorMessage = "Impossibile creare il menu. Riprova.";
const duplicateDateMessage = "Esiste già un menu per questa data.";

export async function createDailyMenuAction(
  _previousState: DailyMenuFormState,
  formData: FormData,
): Promise<DailyMenuFormState> {
  await requireAdmin();

  const values = getDailyMenuFormValues(formData);
  const errors = validateDailyMenuFormValues(values);

  if (Object.keys(errors).length > 0) {
    return dailyMenuFormErrorState(values, errors);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: existingMenu, error: existingMenuError } = await supabase
      .from("daily_menus")
      .select("id")
      .eq("service_date", values.serviceDate)
      .maybeSingle();

    if (existingMenuError) {
      console.error("Verifica della data del menu giornaliero non riuscita.");
      return dailyMenuFormErrorState(values, {}, genericErrorMessage);
    }

    if (existingMenu) {
      return dailyMenuFormErrorState(values, {
        serviceDate: duplicateDateMessage,
      });
    }

    const payload = {
      notes: values.notes.length > 0 ? values.notes : null,
      service_date: values.serviceDate,
      status: "draft",
      title: values.title.length > 0 ? values.title : null,
    };
    const { data: insertedMenu, error: insertError } = await supabase
      .from("daily_menus")
      .insert(payload)
      .select("id, service_date, status")
      .maybeSingle();

    if (insertError) {
      console.error("Creazione del menu giornaliero non riuscita.");

      if (insertError.code === "23505") {
        return dailyMenuFormErrorState(values, {
          serviceDate: duplicateDateMessage,
        });
      }

      return dailyMenuFormErrorState(values, {}, genericErrorMessage);
    }

    if (
      typeof insertedMenu?.id !== "string" ||
      insertedMenu.service_date !== values.serviceDate ||
      insertedMenu.status !== "draft"
    ) {
      console.error("Verifica della creazione del menu giornaliero non riuscita.");
      return dailyMenuFormErrorState(values, {}, genericErrorMessage);
    }
  } catch {
    console.error("Creazione del menu giornaliero non riuscita.");
    return dailyMenuFormErrorState(values, {}, genericErrorMessage);
  }

  revalidatePath("/admin/menu-giornalieri");
  revalidatePath("/admin");
  redirect("/admin/menu-giornalieri");
}
