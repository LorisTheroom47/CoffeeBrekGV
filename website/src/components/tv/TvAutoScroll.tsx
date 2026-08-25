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

    const resetCycle = () => {
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
        viewport.scrollTop = Math.min(
          maximumScroll,
          viewport.scrollTop + (downwardSpeed * elapsedSinceFrame) / 1_000,
        );

        if (viewport.scrollTop >= maximumScroll - 1) {
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
        viewport.scrollTop = Math.max(
          0,
          viewport.scrollTop - (returnSpeed * elapsedSinceFrame) / 1_000,
        );

        if (viewport.scrollTop <= 1) {
          resetCycle();
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(resetCycle);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    reducedMotion.addEventListener("change", resetCycle);
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", resetCycle);
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
