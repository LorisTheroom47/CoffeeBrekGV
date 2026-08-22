import Link from "next/link";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Menu del giorno", href: "/menu" },
  { label: "Contatti", href: "/contatti" },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link className="brand" href="/" aria-label="Coffee Break GV, home">
          Coffee Break <span>GV</span>
        </Link>

        <nav className="desktop-navigation" aria-label="Navigazione principale">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="button button-small button-primary" href="/ordine">
            Ordina
          </Link>
        </nav>

        <details className="mobile-navigation">
          <summary>
            <span>Menu</span>
            <span className="menu-icon" aria-hidden="true" />
          </summary>
          <nav aria-label="Navigazione mobile">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="button button-primary" href="/ordine">
              Ordina
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
