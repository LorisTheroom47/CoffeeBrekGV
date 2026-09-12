import type { Metadata } from "next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ReservationForm from "@/components/reservations/ReservationForm";

export const metadata: Metadata = {
  title: "Prenota un tavolo | Coffee Break GV",
  description: "Prenota il tuo tavolo per pranzo da Coffee Break GV a Monza.",
};
export const dynamic = "force-dynamic";

function getRomeDateAndTime(): Readonly<{ date: string; time: string }> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit",
    month: "2-digit", timeZone: "Europe/Rome", year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    time: `${values.get("hour")}:${values.get("minute")}`,
  };
}

export default function ReservationPage() {
  const nowInRome = getRomeDateAndTime();
  return <><Header /><main className="order-page reservation-page">
    <header className="order-page-header"><div className="site-container order-page-heading">
      <p className="eyebrow">Prenotazione tavoli</p>
      <h1>Il tuo tavolo per pranzo</h1>
      <p className="order-page-intro">Scegli data e ora: la prenotazione viene confermata subito, dalle 12:00 alle 14:00.</p>
    </div></header>
    <section className="section" aria-label="Modulo prenotazione"><div className="site-container reservation-form-container">
      <ReservationForm minimumDate={nowInRome.date} currentRomeTime={nowInRome.time} />
    </div></section>
  </main><Footer /></>;
}
