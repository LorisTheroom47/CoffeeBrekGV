import Link from "next/link";

export default function HomePromo() {
  return (
    <section className="section home-promo-section" aria-labelledby="home-promo-title">
      <div className="site-container">
        <div className="home-promo-card">
          <div>
            <p className="eyebrow">Occasioni da condividere</p>
            <h2 id="home-promo-title">Un servizio pensato per te</h2>
            <p>
              Contattaci per catering, pensionamenti e offerte dedicate:
              troveremo la soluzione più adatta a te!
            </p>
          </div>
          <Link className="button button-primary" href="/contatti">
            Contattaci
          </Link>
        </div>
      </div>
    </section>
  );
}
