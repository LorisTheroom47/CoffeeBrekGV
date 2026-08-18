import { notFound } from "next/navigation";

export default function SuspendedNewDailyMenuPage() {
  // Funzionalità sospesa: nessun form o Server Action è esposto dall'interfaccia.
  notFound();
}
