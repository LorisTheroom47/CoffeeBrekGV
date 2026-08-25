"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MenuItem from "@/components/menu/MenuItem";
import type {
  MenuCategory,
  MenuItem as MenuItemData,
} from "@/lib/menu";

type TvMenuSlidesProps = Readonly<{
  categories: MenuCategory[];
}>;

type MenuSlide = Readonly<{
  categoryId: string;
  categoryName: string;
  items: MenuItemData[];
  key: string;
  part: number;
  totalParts: number;
}>;

const slideDurationMs = 9_000;
const fallbackItemsPerSlide = 4;

function getVisibleCategories(categories: MenuCategory[]) {
  const populatedCategories = categories.filter(
    (category) => category.items.length > 0,
  );

  return populatedCategories.length > 0 ? populatedCategories : categories;
}

function createCategorySlides(
  category: MenuCategory,
  chunks: MenuItemData[][],
): MenuSlide[] {
  return chunks.map((items, index) => ({
    categoryId: category.id,
    categoryName: category.name,
    items,
    key: `${category.id}-${index + 1}`,
    part: index + 1,
    totalParts: chunks.length,
  }));
}

function createFallbackSlides(categories: MenuCategory[]) {
  return getVisibleCategories(categories).flatMap((category) => {
    if (category.items.length === 0) {
      return createCategorySlides(category, [[]]);
    }

    const chunks: MenuItemData[][] = [];
    for (
      let itemIndex = 0;
      itemIndex < category.items.length;
      itemIndex += fallbackItemsPerSlide
    ) {
      chunks.push(
        category.items.slice(itemIndex, itemIndex + fallbackItemsPerSlide),
      );
    }

    return createCategorySlides(category, chunks);
  });
}

function getSlidesSignature(slides: MenuSlide[]) {
  return slides
    .map((slide) => `${slide.key}:${slide.items.map((item) => item.id).join(",")}`)
    .join("|");
}

export default function TvMenuSlides({ categories }: TvMenuSlidesProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slidesSignatureRef = useRef("");
  const [slides, setSlides] = useState(() => createFallbackSlides(categories));
  const [activeSlide, setActiveSlide] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    let scheduledMeasurement = 0;

    const measureSlides = () => {
      const availableHeight = viewport.clientHeight;
      const measurementCards = Array.from(
        viewport.querySelectorAll<HTMLElement>("[data-tv-measure-category]"),
      );
      const cardsByCategory = new Map(
        measurementCards.map((card) => [card.dataset.tvMeasureCategory, card]),
      );

      const measuredSlides = getVisibleCategories(categories).flatMap(
        (category) => {
          const card = cardsByCategory.get(category.id);
          const list = card?.querySelector("ul");
          const itemElements = list
            ? Array.from(list.children) as HTMLElement[]
            : [];

          if (!card || !list || availableHeight <= 0) {
            return createFallbackSlides([category]);
          }

          if (category.items.length === 0) {
            return createCategorySlides(category, [[]]);
          }

          const cardHeight = card.getBoundingClientRect().height;
          const listHeight = list.getBoundingClientRect().height;
          const fixedCardHeight = Math.max(0, cardHeight - listHeight);
          const itemsHeightLimit = Math.max(1, availableHeight - fixedCardHeight);
          const chunks: MenuItemData[][] = [];
          let currentChunk: MenuItemData[] = [];
          let currentHeight = 0;

          category.items.forEach((item, itemIndex) => {
            const itemHeight =
              itemElements[itemIndex]?.getBoundingClientRect().height ??
              itemsHeightLimit;

            if (
              currentChunk.length > 0 &&
              currentHeight + itemHeight > itemsHeightLimit
            ) {
              chunks.push(currentChunk);
              currentChunk = [];
              currentHeight = 0;
            }

            currentChunk.push(item);
            currentHeight += itemHeight;
          });

          if (currentChunk.length > 0) chunks.push(currentChunk);

          return createCategorySlides(category, chunks);
        },
      );
      const nextSignature = getSlidesSignature(measuredSlides);

      if (nextSignature !== slidesSignatureRef.current) {
        slidesSignatureRef.current = nextSignature;
        setSlides(measuredSlides);
        setActiveSlide(0);
      }
    };

    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(scheduledMeasurement);
      scheduledMeasurement = window.requestAnimationFrame(measureSlides);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasurement);
    resizeObserver?.observe(viewport);
    window.addEventListener("resize", scheduleMeasurement);
    scheduleMeasurement();

    if (document.fonts) {
      void document.fonts.ready.then(scheduleMeasurement);
    }

    return () => {
      window.cancelAnimationFrame(scheduledMeasurement);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [categories]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, slideDurationMs);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  return (
    <div
      className="tv-menu-slides"
      ref={viewportRef}
      aria-label="Menu del giorno a rotazione automatica"
    >
      <div className="tv-menu-slides-stage">
        {slides.map((slide, index) => {
          const titleId = `tv-slide-title-${slide.key}`;
          const isActive = index === activeSlide;

          return (
            <div
              className={`tv-menu-slide${isActive ? " is-active" : ""}`}
              aria-hidden={!isActive}
              key={slide.key}
            >
              <section
                className="tv-menu-category"
                aria-labelledby={titleId}
              >
                <h2 id={titleId}>
                  <span>{slide.categoryName}</span>
                  {slide.totalParts > 1 ? (
                    <small>
                      {slide.part}/{slide.totalParts}
                    </small>
                  ) : null}
                </h2>
                <ul>
                  {slide.items.map((item) => (
                    <MenuItem item={item} key={item.id} showImage={false} />
                  ))}
                </ul>
              </section>
            </div>
          );
        })}
      </div>

      <div className="tv-menu-slides-measure" aria-hidden="true">
        {getVisibleCategories(categories).map((category) => (
          <section
            className="tv-menu-category"
            data-tv-measure-category={category.id}
            key={category.id}
          >
            <h2>{category.name}</h2>
            <ul>
              {category.items.map((item) => (
                <MenuItem item={item} key={item.id} showImage={false} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
