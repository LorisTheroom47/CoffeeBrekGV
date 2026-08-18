const services = [
  {
    title: "Mangia nel locale",
    description:
      "Concediti una pausa accogliente e gusta il pranzo appena preparato.",
    icon: "plate",
  },
  {
    title: "Ritira da asporto",
    description:
      "Porta con te i piatti del giorno, con la stessa cura del servizio al tavolo.",
    icon: "bag",
  },
  {
    title: "Consegna a domicilio",
    description:
      "Stiamo lavorando per portare Coffee Break direttamente dove ti serve.",
    icon: "delivery",
    badge: "Prossimamente",
  },
];

export default function Services() {
  return (
    <section className="section services-section" aria-labelledby="services-title">
      <div className="site-container">
        <div className="section-heading section-heading-centered">
          <p className="eyebrow">Il pranzo come preferisci</p>
          <h2 id="services-title">I nostri servizi</h2>
        </div>

        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <span
                className={`service-icon service-icon-${service.icon}`}
                aria-hidden="true"
              />
              <div className="service-title-row">
                <h3>{service.title}</h3>
                {service.badge ? (
                  <span className="status-badge">{service.badge}</span>
                ) : null}
              </div>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
