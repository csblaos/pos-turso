"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type TooltipSide = "top" | "bottom";

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  disabled?: boolean;
  side?: TooltipSide;
};

type Position = {
  top: number;
  left: number;
  transform: string;
  arrowTransform: string;
  arrowTop: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function computePosition(side: TooltipSide, rect: DOMRect): Position {
  const gap = 10;
  const left = rect.left + rect.width / 2;

  if (side === "bottom") {
    return {
      top: rect.bottom + gap,
      left,
      transform: "translate(-50%, 0)",
      arrowTransform: "translate(-50%, -50%) rotate(45deg)",
      arrowTop: "0px",
    };
  }

  return {
    top: rect.top - gap,
    left,
    transform: "translate(-50%, -100%)",
    arrowTransform: "translate(-50%, 50%) rotate(45deg)",
    arrowTop: "100%",
  };
}

export function Tooltip({ content, children, disabled, side = "top" }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const next = computePosition(side, rect);

      const tooltipWidth = tooltipRef.current?.offsetWidth ?? 0;
      const viewportPadding = 12;
      const clampedLeft = tooltipWidth
        ? clamp(next.left, viewportPadding + tooltipWidth / 2, window.innerWidth - viewportPadding - tooltipWidth / 2)
        : next.left;

      setPos({ ...next, left: clampedLeft });
    };

    update();

    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      cancelAnimationFrame(raf);
    };
  }, [open, side]);

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex min-w-0"
      >
        {children}
      </span>

      {mounted && open && pos
        ? createPortal(
            <div
              ref={tooltipRef}
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[120] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-900/10 bg-slate-950 px-3 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]"
              style={{
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                transform: pos.transform,
              }}
            >
              <div className="break-words leading-snug">{content}</div>
              <div
                aria-hidden
                className="absolute h-2.5 w-2.5 border border-slate-900/10 bg-slate-950"
                style={{
                  left: "50%",
                  top: pos.arrowTop,
                  transform: pos.arrowTransform,
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

