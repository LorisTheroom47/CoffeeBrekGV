import type { MenuCategory as MenuCategoryData } from "@/lib/menu";
import MenuItem from "./MenuItem";

type MenuCategoryProps = {
  category: MenuCategoryData;
  headingLevel?: "h2" | "h3";
};

export default function MenuCategory({
  category,
  headingLevel = "h2",
}: MenuCategoryProps) {
  const Heading = headingLevel;

  return (
    <article className="menu-card" aria-labelledby={`category-${category.id}`}>
      <Heading id={`category-${category.id}`}>{category.name}</Heading>
      <ul>
        {category.items.map((item) => (
          <MenuItem item={item} key={item.id} />
        ))}
      </ul>
    </article>
  );
}
