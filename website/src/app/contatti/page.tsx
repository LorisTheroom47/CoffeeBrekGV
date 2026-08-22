import type { Metadata } from "next";
import ContactDetails from "@/components/contact/ContactDetails";
import LocationPlaceholder from "@/components/contact/LocationPlaceholder";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Contatti | Coffee Break GV",
  description:
    "Informazioni e indirizzo di Coffee Break GV in Via Pergolesi 33.",
};

export default function ContactsPage() {
  return (
    <>
      <Header />
      <main className="contact-page">
        <header className="contact-page-header">
          <div className="site-container">
            <p className="eyebrow">Siamo a Monza</p>
            <h1>Contatti</h1>
            <p>
              Tutte le informazioni utili per venirci a trovare e trascorrere
              con noi la tua pausa pranzo.
            </p>
          </div>
        </header>

        <div className="section">
          <div className="site-container contact-page-grid">
            <ContactDetails />
            <LocationPlaceholder />
          </div>
        </div>

        <section className="reach-us-section" aria-labelledby="reach-us-title">
          <div className="site-container reach-us-content">
            <p className="eyebrow">Nel cuore della tua giornata</p>
            <h2 id="reach-us-title">Come raggiungerci</h2>
            <p>
              Coffee Break GV si trova in Via Pergolesi 33. Raggiungici per
              il pranzo e scegli se fermarti nel locale oppure ritirare i tuoi
              piatti da asporto.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
