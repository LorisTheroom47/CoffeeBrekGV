export default function RestaurantInfo() {
  return (
    <section className="section info-section" id="contatti">
      <div className="site-container info-grid">
        <div className="info-copy">
          <p className="eyebrow">Un posto semplice, fatto con cura</p>
          <h2>La tua tavola quotidiana</h2>
          <p>
            Coffee Break GV è un luogo caldo e informale dove fermarsi per un
            pranzo preparato ogni giorno. Ti aspettiamo con proposte genuine, da
            gustare con calma nel locale oppure da portare con te.
          </p>
          <div className="info-highlights" aria-label="Servizi disponibili">
            <span>Servizio pranzo</span>
            <span>Nel locale</span>
            <span>Da asporto</span>
          </div>
        </div>

        <address className="contact-card">
          <p className="contact-label">Dove trovarci</p>
          <h3>Via Pergolesi 33, Monza</h3>
          <dl>
            <div>
              <dt>Telefono</dt>
              <dd>
                <a href="tel:+3903922339799">039 223 39799</a>
                <br />
                <a href="tel:+393480629825">348 062 9825</a>
              </dd>
            </div>
            <div>
              <dt>Orari</dt>
              <dd>6:30 – 16:30</dd>
            </div>
            <div>
              <dt>Ordini</dt>
              <dd>Entro le 10:00</dd>
            </div>
          </dl>
          <a
            className="text-link"
            href="https://www.google.com/maps/search/?api=1&query=Via+Pergolesi+33%2C+Monza"
            target="_blank"
            rel="noreferrer"
          >
            Apri la posizione sulla mappa
          </a>
        </address>
      </div>
    </section>
  );
}
