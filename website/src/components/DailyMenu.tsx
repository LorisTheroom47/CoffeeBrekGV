import Link from "next/link";
import MenuCategory from "@/components/menu/MenuCategory";
import type { MenuCategory as MenuCategoryData } from "@/lib/menu";

type DailyMenuProps = {
  categories: MenuCategoryData[];
};

export default function DailyMenu({ categories }: DailyMenuProps) {
  const previewCategories = categories.slice(0, 2);

  return (
    <section className="section menu-section" id="menu">
      <div className="site-container">
        <div className="section-heading">
          <p className="eyebrow">Una proposta diversa ogni giorno</p>
          <h2>Il menu di oggi</h2>
          <p>
            Una selezione di piatti semplici e curati, pensati per rendere
            piacevole anche la pausa pranzo più veloce.
          </p>
        </div>

        <div className="menu-grid">
          {previewCategories.map((category) => (
            <MenuCategory
              category={category}
              headingLevel="h3"
              key={category.id}
            />
          ))}
        </div>

        <div className="menu-preview-footer">
          <p className="menu-note">
            Menu dimostrativo: i piatti verranno aggiornati quotidianamente.
          </p>
          <Link className="button button-primary" href="/menu">
            Visualizza tutto il menu
          </Link>
        </div>
      </div>
    </section>
  );
}
