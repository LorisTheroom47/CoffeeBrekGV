import Image from "next/image";

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
            con consegna in ospedale. Ordina entro le 10:00.
          </p>
          <div className="button-group">
            <a className="button button-primary" href="#menu">
              Scopri il menu
            </a>
            <a className="button button-secondary" href="#contatti">
              Come raggiungerci
            </a>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="visual-sun" />
          <div className="visual-leaf visual-leaf-one" />
          <div className="visual-leaf visual-leaf-two" />
          <div className="visual-plate">
            <div className="visual-plate-center" />
          </div>
          <div className="visual-cup">
            <div className="visual-coffee" />
          </div>
          <div className="visual-cup-handle" />
          <div className="visual-steam visual-steam-one" />
          <div className="visual-steam visual-steam-two" />
        </div>
      </div>
    </section>
  );
}
