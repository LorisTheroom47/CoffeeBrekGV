"use client";

import { useEffect, useRef, type ReactNode } from "react";

type TvAutoScrollProps = Readonly<{
  children: ReactNode;
}>;

const initialPauseMs = 3_000;
const bottomPauseMs = 3_000;
const downwardSpeed = 18;
const returnSpeed = 72;

export default function TvAutoScroll({ children }: TvAutoScrollProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let phase: "initial" | "down" | "bottom" | "up" = "initial";
    let phaseStartedAt = performance.now();
    let previousFrameAt = phaseStartedAt;
    let scrollPosition = 0;

    const resetCycle = () => {
      scrollPosition = 0;
      viewport.scrollTop = 0;
      phase = "initial";
      phaseStartedAt = performance.now();
      previousFrameAt = phaseStartedAt;
    };

    const animate = (currentTime: number) => {
      const maximumScroll = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );

      if (reducedMotion.matches || maximumScroll <= 1) {
        scrollPosition = 0;
        viewport.scrollTop = 0;
        previousFrameAt = currentTime;
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      const elapsedSinceFrame = Math.min(currentTime - previousFrameAt, 100);
      previousFrameAt = currentTime;

      if (phase === "initial") {
        if (currentTime - phaseStartedAt >= initialPauseMs) {
          phase = "down";
          phaseStartedAt = currentTime;
        }
      } else if (phase === "down") {
        scrollPosition = Math.min(
          maximumScroll,
          scrollPosition + (downwardSpeed * elapsedSinceFrame) / 1_000,
        );
        viewport.scrollTop = Math.round(scrollPosition);

        if (scrollPosition >= maximumScroll) {
          scrollPosition = maximumScroll;
          viewport.scrollTop = maximumScroll;
          phase = "bottom";
          phaseStartedAt = currentTime;
        }
      } else if (phase === "bottom") {
        if (currentTime - phaseStartedAt >= bottomPauseMs) {
          phase = "up";
          phaseStartedAt = currentTime;
        }
      } else {
        scrollPosition = Math.max(
          0,
          scrollPosition - (returnSpeed * elapsedSinceFrame) / 1_000,
        );
        viewport.scrollTop = Math.round(scrollPosition);

        if (scrollPosition <= 0) {
          resetCycle();
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(resetCycle);
    resizeObserver?.observe(viewport);
    if (resizeObserver && viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    window.addEventListener("resize", resetCycle);
    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", resetCycle);
    } else {
      reducedMotion.addListener(resetCycle);
    }
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resetCycle);
      if (typeof reducedMotion.removeEventListener === "function") {
        reducedMotion.removeEventListener("change", resetCycle);
      } else {
        reducedMotion.removeListener(resetCycle);
      }
    };
  }, []);

  return (
    <div
      className="tv-menu-scroll"
      ref={viewportRef}
      aria-label="Menu del giorno a scorrimento automatico"
    >
      <div className="tv-menu-scroll-content">{children}</div>
    </div>
  );
}
