"use client";

import * as React from "react";

import type { UiLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

type CashFlowTrendPoint = {
  bucketDate: string; // YYYY-MM-DD
  totalIn: number;
  totalOut: number;
  net: number;
};

function formatShortDate(value: string, locale: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickLabelIndices(length: number, target: number) {
  if (length <= target) return new Set(Array.from({ length }, (_, i) => i));
  const last = length - 1;
  const indices = new Set<number>([0, last]);
  const steps = target - 2;
  for (let i = 1; i <= steps; i++) {
    const idx = Math.round((i / (steps + 1)) * last);
    indices.add(idx);
  }
  return indices;
}

const CHART_W = 640;
const CHART_H = 220;
const PAD = { l: 48, r: 16, t: 14, b: 44 };

export function CashFlowTrendChart({
  points,
  numberLocale,
  currency,
  uiLocale,
}: {
  points: CashFlowTrendPoint[];
  numberLocale: string;
  currency: string;
  uiLocale: UiLocale;
}) {
  const fmt = React.useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);

  const maxValue = React.useMemo(() => {
    if (points.length === 0) return 1;
    return Math.max(...points.map((p) => Math.max(p.totalIn, p.totalOut)), 1);
  }, [points]);

  const iw = CHART_W - PAD.l - PAD.r;
  const ih = CHART_H - PAD.t - PAD.b;

  const xForIndex = React.useCallback(
    (idx: number) => {
      if (points.length <= 1) return PAD.l + iw / 2;
      return PAD.l + (idx / (points.length - 1)) * iw;
    },
    [points.length, iw],
  );

  const yForValue = React.useCallback(
    (value: number) => PAD.t + (1 - value / maxValue) * ih,
    [maxValue, ih],
  );

  const labelIdx = React.useMemo(
    () => pickLabelIndices(Math.max(points.length, 1), 6),
    [points.length],
  );

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [pinned, setPinned] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nearestIndexFromClientX = React.useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      if (points.length <= 1) return 0;
      const pxPerStep = rect.width / (points.length - 1);
      const idx = Math.round(x / pxPerStep);
      return clamp(idx, 0, points.length - 1);
    },
    [points.length],
  );

  const onMove = React.useCallback(
    (clientX: number) => {
      const idx = nearestIndexFromClientX(clientX);
      if (idx === null) return;
      setActiveIndex(idx);
    },
    [nearestIndexFromClientX],
  );

  React.useEffect(() => {
    if (pinned) return;
    setActiveIndex(Math.max(0, points.length - 1));
  }, [points.length, pinned]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{t(uiLocale, "cashFlow.common.noData")}</p>;
  }

  const safeActiveIndex = clamp(activeIndex, 0, points.length - 1);
  const activePoint = points[safeActiveIndex]!;
  const activeX = xForIndex(safeActiveIndex);
  const tooltipLeftPx = containerWidth > 0 ? (activeX / CHART_W) * containerWidth : 0;
  const tooltipWidthPx = containerWidth > 0 ? Math.min(272, Math.max(0, containerWidth - 24)) : 272;
  const tooltipHalfPx = tooltipWidthPx / 2;
  const tooltipMarginPx = 12;
  const tooltipCenterPx =
    containerWidth > 0
      ? clamp(
          tooltipLeftPx,
          tooltipHalfPx + tooltipMarginPx,
          Math.max(tooltipHalfPx + tooltipMarginPx, containerWidth - (tooltipHalfPx + tooltipMarginPx)),
        )
      : 0;

  const barGroupWidth = points.length <= 1 ? 22 : Math.min(26, Math.max(18, iw / points.length));
  const barGap = 4;
  const barWidth = Math.max(6, Math.floor((barGroupWidth - barGap) / 2));

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
        onMouseMove={(e) => {
          if (pinned) return;
          onMove(e.clientX);
        }}
        onMouseLeave={() => {
          if (!pinned) setActiveIndex(Math.max(0, points.length - 1));
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          setPinned(true);
          onMove(touch.clientX);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          onMove(touch.clientX);
        }}
        onClick={(e) => {
          const idx = nearestIndexFromClientX(e.clientX);
          if (idx === null) return;
          setActiveIndex(idx);
          setPinned((v) => !v);
        }}
        role="group"
        aria-label="Cash flow trend chart"
      >
        <div
          className="pointer-events-none absolute top-3 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur"
          style={{ width: `${tooltipWidthPx}px`, left: `${tooltipCenterPx}px` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700">
                {formatShortDate(activePoint.bucketDate, numberLocale)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {t(uiLocale, "cashFlow.summary.net")}:{" "}
                {activePoint.net >= 0 ? "+" : "-"}
                {fmt.format(Math.abs(activePoint.net))} {currency}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-slate-500">
              <div className="flex items-center justify-end gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span>
                  {fmt.format(activePoint.totalIn)} {currency}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-end gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                <span>
                  {fmt.format(activePoint.totalOut)} {currency}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {pinned
              ? t(uiLocale, "cashFlow.chart.tooltip.hintPinned")
              : t(uiLocale, "cashFlow.chart.tooltip.hintExplore")}
          </p>
        </div>

        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-56 w-full">
          {[0, 0.5, 1].map((tTick) => {
            const y = PAD.t + (1 - tTick) * ih;
            const value = Math.round(maxValue * tTick);
            return (
              <g key={tTick}>
                <line
                  x1={PAD.l}
                  x2={CHART_W - PAD.r}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={PAD.l - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#64748b"
                >
                  {fmt.format(value)}
                </text>
              </g>
            );
          })}

          {points.map((p, idx) => {
            const xCenter = xForIndex(idx);
            const inY = yForValue(p.totalIn);
            const outY = yForValue(p.totalOut);
            const baseY = PAD.t + ih;
            const inH = Math.max(6, baseY - inY);
            const outH = Math.max(6, baseY - outY);
            const xLeft = xCenter - barGroupWidth / 2;

            const isActive = idx === safeActiveIndex;
            const outline = isActive ? "#0f172a" : "transparent";
            const outlineWidth = isActive ? 1 : 0;

            return (
              <g key={p.bucketDate}>
                <rect
                  x={xLeft}
                  y={baseY - inH}
                  width={barWidth}
                  height={inH}
                  rx={6}
                  fill="#10b981"
                  stroke={outline}
                  strokeWidth={outlineWidth}
                  opacity={isActive ? 1 : 0.85}
                />
                <rect
                  x={xLeft + barWidth + barGap}
                  y={baseY - outH}
                  width={barWidth}
                  height={outH}
                  rx={6}
                  fill="#f43f5e"
                  stroke={outline}
                  strokeWidth={outlineWidth}
                  opacity={isActive ? 1 : 0.85}
                />

                {labelIdx.has(idx) ? (
                  <text
                    x={xCenter}
                    y={CHART_H - 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#64748b"
                  >
                    {formatShortDate(p.bucketDate, numberLocale)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t(uiLocale, "cashFlow.summary.totalIn")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          {t(uiLocale, "cashFlow.summary.totalOut")}
        </span>
      </div>
    </div>
  );
}

