"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
};

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Subtle scroll-in (W14). Respects prefers-reduced-motion. */
export function Reveal({ children, className, delayMs = 0 }: RevealProps) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const ref = useRef<HTMLDivElement>(null);
  // Start visible for SSR / first paint; only animate if still below fold after mount.
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // reduceMotion → show without mount animation (derived via `show` below).
    if (reduceMotion) return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const inView =
      rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (inView) {
      setVisible(true);
      setReady(true);
      return;
    }

    setVisible(false);
    setReady(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const show = reduceMotion || !ready || visible;

  return (
    <div
      ref={ref}
      className={cn(
        // Only apply opacity:0 after mount when we know the node is below the fold.
        ready && !reduceMotion && "marketing-reveal",
        show && "marketing-reveal--visible",
        className,
      )}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
