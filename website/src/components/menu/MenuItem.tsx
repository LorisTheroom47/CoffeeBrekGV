import Image from "next/image";
import type { MenuItem as MenuItemData } from "@/lib/menu";
import MenuItemAllergens from "./MenuItemAllergens";

type MenuItemProps = {
  item: MenuItemData;
  showImage?: boolean;
};

const priceFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export default function MenuItem({ item, showImage = true }: MenuItemProps) {
  return (
    <li className={`menu-item${item.available ? "" : " menu-item-unavailable"}`}>
      <div className="menu-item-content">
        {showImage && item.imageUrl ? (
          <div className="menu-item-image">
            <Image alt="" fill sizes="5rem" src={item.imageUrl} />
          </div>
        ) : null}
        <div className="menu-item-details">
          <div className="menu-item-name">
            <span>{item.name}</span>
            {!item.available ? (
              <span className="availability-badge">Terminato</span>
            ) : null}
          </div>
          <MenuItemAllergens allergens={item.allergens} />
        </div>
      </div>
      <strong>{priceFormatter.format(item.price)}</strong>
    </li>
  );
}
