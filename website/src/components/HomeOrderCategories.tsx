import Link from "next/link";
import {
  orderCategoryFilters,
  type OrderCategorySlug,
} from "@/lib/orders/categories";

function CategoryIllustration({ slug }: { slug: OrderCategorySlug }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    viewBox: "0 0 96 96",
  } as const;

  switch (slug) {
    case "primi":
      return (
        <svg {...commonProps}>
          <path d="M20 49h56c-2 18-12 27-28 27S22 67 20 49Z" />
          <path d="M27 41c7-10 14 6 21-5s14 5 21-6M34 24v11M49 20v11M64 24v11" />
        </svg>
      );
    case "secondi":
      return (
        <svg {...commonProps}>
          <circle cx="48" cy="48" r="27" />
          <circle cx="48" cy="48" r="18" />
          <path d="M15 25v46M9 25v16c0 6 12 6 12 0V25M81 25v46M75 25c0 13 12 13 12 0" />
        </svg>
      );
    case "insalate":
      return (
        <svg {...commonProps}>
          <path d="M19 51h58c-3 17-13 25-29 25S22 68 19 51Z" />
          <path d="M29 48c-8-15 12-23 18-8M47 44c0-19 22-19 22-4M48 40c-10-18-25-8-19 8M48 40c5-12 13-18 22-18" />
        </svg>
      );
    case "panini":
      return (
        <svg {...commonProps}>
          <path d="M19 43c2-16 13-23 29-23s27 7 29 23H19Z" />
          <path d="m19 52 13 7 16-7 16 7 13-7M20 62h56v12H20zM31 33h2M47 29h2M63 34h2" />
        </svg>
      );
    case "piadine":
      return (
        <svg {...commonProps}>
          <circle cx="48" cy="48" r="29" />
          <path d="M23 60c14-13 36-13 50 0M30 48c5-10 12-15 18-15s13 5 18 15M36 61l12 13 12-13" />
        </svg>
      );
    case "bevande":
      return (
        <svg {...commonProps}>
          <path d="M31 30h37l-4 46H35L31 30Z" />
          <path d="M29 30h42M57 30l9-15h13M35 49h30M43 21c0-7 10-7 10-14" />
        </svg>
      );
    case "brioches-di-pasticceria":
      return (
        <svg {...commonProps}>
          <path d="M20 59c8-25 22-35 28-35s20 10 28 35c-8 11-17 17-28 17S28 70 20 59Z" />
          <path d="M29 43c6 6 13 9 19 9s13-3 19-9M38 28l10 24 10-24M27 61c14-7 28-7 42 0" />
        </svg>
      );
    case "senzaglutine":
      return (
        <svg {...commonProps}>
          <path d="M48 79V21M48 38c-14 0-20-8-20-16 12 0 20 5 20 16ZM48 52c14 0 20-8 20-16-12 0-20 5-20 16ZM48 65c-14 0-20-8-20-16 12 0 20 5 20 16Z" />
          <path d="m18 18 60 60" />
        </svg>
      );
  }
}

export default function HomeOrderCategories() {
  return (
    <section className="home-order-categories" aria-labelledby="home-order-categories-title">
      <div className="site-container">
        <div className="home-order-categories-heading">
          <p className="eyebrow">Ordina online</p>
          <h2 id="home-order-categories-title">Cosa vuoi ordinare?</h2>
          <p>Scegli una categoria e componi il tuo pranzo in pochi passaggi.</p>
        </div>

        <div className="home-order-category-grid">
          {orderCategoryFilters.map((category) => (
            <Link
              className="home-order-category-card"
              href={`/ordine?categoria=${category.slug}`}
              key={category.slug}
            >
              <span className="home-order-category-illustration">
                <CategoryIllustration slug={category.slug} />
              </span>
              <span>{category.name}</span>
            </Link>
          ))}
        </div>

        <div className="home-order-categories-action">
          <Link className="button button-primary" href="/ordine">
            Vedi tutto e ordina
          </Link>
        </div>
      </div>
    </section>
  );
}
