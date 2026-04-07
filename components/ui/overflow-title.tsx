"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Tooltip } from "@/components/ui/tooltip";

type OverflowTitleProps = {
  value: string;
  className?: string;
};

function isOverflown(element: HTMLElement) {
  // Use a small epsilon because scrollWidth/clientWidth can be fractional/rounded.
  return element.scrollWidth - element.clientWidth > 1;
}

export function OverflowTitle({ value, className }: OverflowTitleProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const overflown = isOverflown(element);
        const styles = window.getComputedStyle(element);
        const usesEllipsis =
          styles.textOverflow === "ellipsis" &&
          styles.overflowX === "hidden" &&
          styles.whiteSpace === "nowrap";
        // Fallback: when we render truncated pills, long strings should still expose full text.
        const longValue = value.length >= 18;
        setShouldShowTooltip(overflown || (usesEllipsis && longValue));
      });
    };

    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => update());
      ro.observe(element);
    }

    // Re-check after fonts are ready to avoid false negatives on first paint.
    void (document as unknown as { fonts?: { ready?: Promise<void> } }).fonts?.ready?.then(() =>
      update(),
    );

    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [value]);

  const pill = (
    <span
      ref={ref}
      className={["inline-block min-w-0", className ?? ""].join(" ").trim()}
    >
      {value}
    </span>
  );

  if (!shouldShowTooltip) {
    return pill;
  }

  return (
    <Tooltip content={value}>
      {pill}
    </Tooltip>
  );
}
