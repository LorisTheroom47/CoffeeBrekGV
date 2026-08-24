import MenuItem from "@/components/menu/MenuItem";
import type { MenuCategory as MenuCategoryData } from "@/lib/menu";

type TvMenuCategoryProps = {
  category: MenuCategoryData;
};

export default function TvMenuCategory({ category }: TvMenuCategoryProps) {
  return (
    <section
      className="tv-menu-category"
      aria-labelledby={`tv-category-${category.id}`}
    >
      <h2 id={`tv-category-${category.id}`}>{category.name}</h2>
      <ul>
        {category.items.map((item) => (
          <MenuItem item={item} key={item.id} showImage={false} />
        ))}
      </ul>
    </section>
  );
}
