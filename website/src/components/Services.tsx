import Link from "next/link";

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
    title: "Consegne in ospedale",
    description:
      "A · B · C · Pronto Soccorso · Maria Letizia Verga",
    icon: "delivery",
    href: "/ordine",
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
          {services.map((service) => {
            const content = (
              <>
              <span
                className={`service-icon service-icon-${service.icon}`}
                aria-hidden="true"
              />
              <div className="service-title-row">
                <h3>{service.title}</h3>
              </div>
              <p>{service.description}</p>
              </>
            );

            return service.href ? (
              <Link
                className="service-card service-card-link"
                href={service.href}
                key={service.title}
              >
                {content}
              </Link>
            ) : (
              <article className="service-card" key={service.title}>
                {content}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
