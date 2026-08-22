import type { Metadata } from "next";
import MenuUnavailable from "@/components/menu/MenuUnavailable";
import TvHeader from "@/components/tv/TvHeader";
import TvMenuGrid from "@/components/tv/TvMenuGrid";
import { getMenuCategories } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu TV | Coffee Break GV",
  description: "Menu del giorno di Coffee Break GV in modalità TV.",
};

const timeZone = "Europe/Rome";

function getCurrentItalianDate() {
  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).formatToParts(now);
  const parts = Object.fromEntries(
    dateParts.map((part) => [part.type, part.value]),
  );

  return {
    label: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export default async function TvPage() {
  const currentDate = getCurrentItalianDate();
  let categories = null;

  try {
    categories = await getMenuCategories();
  } catch {
    // La pagina mostra uno stato controllato senza dettagli tecnici.
  }

  if (!categories) {
    return (
      <main className="tv-page tv-page-unavailable">
        <TvHeader date={currentDate.label} dateTime={currentDate.iso} />
        <MenuUnavailable variant="tv" />
      </main>
    );
  }

  return (
    <main className="tv-page">
      <TvHeader date={currentDate.label} dateTime={currentDate.iso} />
      <TvMenuGrid categories={categories} />
      <p className="tv-note">
        Menu dimostrativo: i piatti verranno aggiornati quotidianamente.
      </p>
    </main>
  );
}
