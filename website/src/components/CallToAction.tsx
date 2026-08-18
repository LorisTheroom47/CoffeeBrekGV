import Link from "next/link";

export default function CallToAction() {
  return (
    <section className="section cta-section" aria-labelledby="cta-title">
      <div className="site-container">
        <div className="cta-card">
          <div>
            <p className="eyebrow eyebrow-light">La pausa giusta è più vicina</p>
            <h2 id="cta-title">Hai già scelto cosa mangiare?</h2>
            <p>
              Consulta il menu del giorno e prepara il tuo pranzo con Coffee
              Break Monza.
            </p>
          </div>
          <Link className="button button-light" href="/ordine">
            Ordina ora
          </Link>
        </div>
      </div>
    </section>
  );
}
