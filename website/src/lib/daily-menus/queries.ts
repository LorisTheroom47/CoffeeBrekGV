import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DailyMenuSummary } from "./types";

type RawDailyMenu = Readonly<{
  id: string;
  service_date: string;
  status: string;
  title: string | null;
}>;

function isRawDailyMenu(value: unknown): value is RawDailyMenu {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const menu = value as Record<string, unknown>;
  return (
    typeof menu.id === "string" &&
    typeof menu.service_date === "string" &&
    typeof menu.status === "string" &&
    (typeof menu.title === "string" || menu.title === null)
  );
}

export async function getDailyMenus(): Promise<DailyMenuSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_menus")
    .select("id, service_date, title, status")
    .order("service_date", { ascending: true });

  if (error) {
    throw new Error("Impossibile caricare i menu giornalieri.");
  }

  const rows: unknown[] = data ?? [];

  if (!rows.every(isRawDailyMenu)) {
    throw new Error("Impossibile caricare i menu giornalieri.");
  }

  return rows.map((menu) => ({
    id: menu.id,
    serviceDate: menu.service_date,
    status: menu.status,
    title: menu.title,
  }));
}
