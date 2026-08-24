import CallToAction from "@/components/CallToAction";
import DailyMenu from "@/components/DailyMenu";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HomePromo from "@/components/HomePromo";
import MenuUnavailable from "@/components/menu/MenuUnavailable";
import RestaurantInfo from "@/components/RestaurantInfo";
import Services from "@/components/Services";
import { getMenuCategories } from "@/lib/menu";

export const dynamic = "force-dynamic";

export default async function Home() {
  let categories = null;

  try {
    categories = await getMenuCategories();
  } catch {
    // La pagina mostra uno stato controllato senza dettagli tecnici.
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        {categories ? (
          <DailyMenu categories={categories} />
        ) : (
          <MenuUnavailable />
        )}
        <Services />
        <RestaurantInfo />
        <HomePromo />
        <CallToAction />
      </main>
      <Footer />
    </>
  );
}
