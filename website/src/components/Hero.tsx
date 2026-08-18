export default function Hero() {
  return (
    <section className="hero section" id="home">
      <div className="site-container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Pranzo, gusto e semplicità</p>
          <h1>La tua pausa pranzo a Monza</h1>
          <p className="hero-description">
            Piatti preparati ogni giorno, menu completo e sapori semplici da
            gustare nel locale, da asporto o presto anche a domicilio.
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
