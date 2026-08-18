import TvMenuCategory from "@/components/tv/TvMenuCategory";
import type { MenuCategory as MenuCategoryData } from "@/lib/menu";

type TvMenuGridProps = {
  categories: MenuCategoryData[];
};

export default function TvMenuGrid({ categories }: TvMenuGridProps) {
  return (
    <div className="tv-menu-grid">
      {categories.map((category) => (
        <TvMenuCategory category={category} key={category.id} />
      ))}
    </div>
  );
}
