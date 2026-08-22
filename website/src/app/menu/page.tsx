import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MenuCategory from "@/components/menu/MenuCategory";
import MenuUnavailable from "@/components/menu/MenuUnavailable";
import { getMenuCategories } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu del giorno | Coffee Break GV",
  description: "Consulta il menu del giorno di Coffee Break GV.",
};

export default async function MenuPage() {
  let categories = null;

  try {
    categories = await getMenuCategories();
  } catch {
    // La pagina mostra uno stato controllato senza dettagli tecnici.
  }

  return (
    <>
      <Header />
      <main className="menu-page">
        <header className="menu-page-header">
          <div className="site-container">
            <p className="eyebrow">Preparato ogni giorno</p>
            <h1>Menu del giorno</h1>
            <p>
              Scopri le proposte preparate oggi: piatti semplici, curati e
              pensati per una pausa pranzo piacevole.
            </p>
          </div>
        </header>

        <section className="section menu-page-content" aria-label="Piatti del giorno">
          <div className="site-container">
            {categories ? (
              <>
                <div className="menu-grid">
                  {categories.map((category) => (
                    <MenuCategory category={category} key={category.id} />
                  ))}
                </div>
                <p className="menu-note">
                  Menu dimostrativo: i piatti verranno aggiornati
                  quotidianamente.
                </p>
                <Link className="tv-access-link" href="/tv">
                  Apri modalità TV
                </Link>
              </>
            ) : (
              <MenuUnavailable />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
