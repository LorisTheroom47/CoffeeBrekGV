import type { Metadata } from "next";
import Image from "next/image";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getMenuCategories, type MenuItem } from "@/lib/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery | Coffee Break GV",
  description:
    "Scopri il locale e i piatti preparati da Coffee Break GV a Monza.",
};

const galleryPhotos = [
  {
    alt: "La sala e il bancone di Coffee Break GV",
    caption: "La sala e il bancone",
    src: "/images/gallery/locale-bancone-01.jpg",
  },
  {
    alt: "Vista ampia del bancone di Coffee Break GV",
    caption: "Il bancone",
    src: "/images/gallery/locale-bancone-02.jpg",
  },
  {
    alt: "La sala di Coffee Break GV con i tavoli",
    caption: "La sala",
    src: "/images/gallery/locale-sala-01.jpg",
  },
  {
    alt: "Tavoli e bancone nel locale Coffee Break GV",
    caption: "Gli spazi del locale",
    src: "/images/gallery/locale-sala-02.jpg",
  },
  {
    alt: "Interno luminoso di Coffee Break GV",
    caption: "Coffee Break GV",
    src: "/images/gallery/locale-sala-03.jpg",
  },
  {
    alt: "Vista completa della sala di Coffee Break GV",
    caption: "Il nostro locale",
    src: "/images/gallery/locale-sala-04.jpg",
  },
  {
    alt: "Pollo alla griglia con verdure e patate",
    caption: "Pollo alla griglia con verdure",
    src: "/images/gallery/pollo-verdure.jpg",
  },
  {
    alt: "Riso nero con pesce spada e verdure",
    caption: "Riso nero con pesce spada e verdure",
    src: "/images/gallery/riso-nero-verdure.jpg",
  },
] as const;

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

        <section
          className="section gallery-content"
          aria-label="Fotografie del locale e dei piatti"
        >
          <div className="site-container">
            <div className="gallery-grid">
              {galleryPhotos.map((photo) => (
                <figure className="gallery-card" key={photo.src}>
                  <div className="gallery-card-image">
                    <Image
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 38rem) 100vw, (max-width: 64rem) 50vw, 33vw"
                      src={photo.src}
                    />
                  </div>
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}

              {dishes?.map((dish) => (
                  <figure className="gallery-card" key={dish.id}>
                    <div className="gallery-card-image">
                      <Image
                        alt={`Fotografia di ${dish.name}`}
                        fill
                        sizes="(max-width: 38rem) 100vw, (max-width: 64rem) 50vw, 33vw"
                        src={dish.imageUrl!}
                      />
                    </div>
                    <figcaption>{dish.name}</figcaption>
                  </figure>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
