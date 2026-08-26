import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OrderBuilder from "@/components/orders/OrderBuilder";
import OrderDeadlineNotice from "@/components/OrderDeadlineNotice";
import { getMenuCategories } from "@/lib/menu";
import type { OrderMenuCategory } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Ordina | Coffee Break GV",
  description: "Ordina il tuo pranzo da Coffee Break GV.",
};

export const dynamic = "force-dynamic";

function getTodayInRome(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    calendar: "iso8601",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export default async function OrderPage() {
  let categories: OrderMenuCategory[] | null = null;

  try {
    const menuCategories = await getMenuCategories();

    categories = menuCategories
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items
          .filter((item) => item.available)
          .map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            allergens: item.allergens.map((allergen) => allergen.name),
          })),
      }))
      .filter((category) => category.items.length > 0);
  } catch {
    categories = null;
  }

  return (
    <>
      <Header />
      <main className="order-page">
        <header className="order-page-header">
          <div className="site-container order-page-heading">
            <p className="eyebrow">Ordina online</p>
            <h1>Prepara il tuo pranzo</h1>
            <p className="order-page-intro">
              Scegli i piatti disponibili, ritira da Coffee Break GV oppure
              richiedi la consegna in ospedale nei punti A, B, C, Pronto
              Soccorso o Palazzina Blu.
            </p>
            <OrderDeadlineNotice />
          </div>
        </header>

        <section className="section" aria-labelledby="order-content-title">
          <div className="site-container">
            <h2 className="sr-only" id="order-content-title">
              Componi il tuo ordine
            </h2>

            {categories === null ? (
              <div className="order-message-card" role="status">
                <h2>Ordini temporaneamente non disponibili</h2>
                <p>
                  Non riusciamo a caricare il menu. Riprova tra poco oppure
                  consulta la pagina del menu.
                </p>
                <Link className="button button-secondary" href="/menu">
                  Vai al menu
                </Link>
              </div>
            ) : categories.length === 0 ? (
              <div className="order-message-card" role="status">
                <h2>Nessun piatto disponibile</h2>
                <p>Al momento non ci sono piatti ordinabili. Riprova più tardi.</p>
                <Link className="button button-secondary" href="/menu">
                  Consulta il menu
                </Link>
              </div>
            ) : (
              <OrderBuilder
                categories={categories}
                minimumDate={getTodayInRome()}
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
