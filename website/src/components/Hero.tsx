import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero section" id="home">
      <div className="site-container hero-grid">
        <div className="hero-copy">
          <Image
            className="hero-logo"
            src="/images/coffee-break-gv-logo.png"
            alt="Coffee Break GV"
            width={1672}
            height={941}
            sizes="(max-width: 48rem) 20rem, 27rem"
            priority
          />
          <p className="eyebrow">Coffee Break GV</p>
          <h1>Il tuo pranzo quotidiano, semplice e gustoso</h1>
          <p className="hero-description">
            Piatti preparati ogni giorno da gustare nel locale, da asporto o
            con consegna in ospedale. Ordina entro le 10:30.
          </p>
          <div className="button-group">
            <Link className="button button-primary" href="/ordine">
              Ordina il pranzo
            </Link>
            <Link className="button button-secondary" href="/prenota">
              Prenota un tavolo
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <Image
            alt="Il bancone di Coffee Break GV"
            fill
            priority
            sizes="(max-width: 43rem) calc(100vw - 1.25rem), (max-width: 64rem) 28rem, 32rem"
            src="/images/home-coffee-break.jpg"
          />
        </div>
      </div>
    </section>
  );
}
