import type { Metadata } from "next";
import Image from "next/image";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MenuUnavailable from "@/components/menu/MenuUnavailable";
import { getMenuCategories, type MenuItem } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery dei piatti | Coffee Break GV",
  description:
    "Scopri in fotografia i piatti preparati da Coffee Break GV a Monza.",
};

export default async function GalleryPage() {
  let dishes: MenuItem[] | null = null;

  try {
    const categories = await getMenuCategories();
    dishes = categories.flatMap((category) => category.items).filter(
      (item) => item.imageUrl !== null,
    );
  } catch {
    // La pagina mostra uno stato controllato senza dettagli tecnici.
  }

  return (
    <>
      <Header />
      <main className="gallery-page">
        <header className="gallery-page-header">
          <div className="site-container">
            <p className="eyebrow">Sapori da vedere</p>
            <h1>Gallery</h1>
            <p>
              Uno sguardo ai piatti di Coffee Break GV, preparati con cura per
              la tua pausa pranzo.
            </p>
          </div>
        </header>

        <section className="section gallery-content" aria-label="Fotografie dei piatti">
          <div className="site-container">
            {dishes === null ? (
              <MenuUnavailable />
            ) : dishes.length === 0 ? (
              <div className="gallery-empty" role="status">
                <p className="eyebrow">La cucina è al lavoro</p>
                <h2>Le fotografie arriveranno presto</h2>
                <p>
                  Stiamo preparando nuovi scatti. Nel frattempo puoi scoprire
                  tutte le proposte nel menu del giorno.
                </p>
              </div>
            ) : (
              <div className="gallery-grid">
                {dishes.map((dish, index) => (
                  <figure className="gallery-card" key={dish.id}>
                    <div className="gallery-card-image">
                      <Image
                        alt={`Fotografia di ${dish.name}`}
                        fill
                        priority={index < 2}
                        sizes="(max-width: 38rem) 100vw, (max-width: 64rem) 50vw, 33vw"
                        src={dish.imageUrl!}
                      />
                    </div>
                    <figcaption>{dish.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
