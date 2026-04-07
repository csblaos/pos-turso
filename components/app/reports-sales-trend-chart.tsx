"use client";

import * as React from "react";

type SalesTrendPoint = {
  bucketDate: string; // YYYY-MM-DD
  salesTotal: number;
  orderCount: number;
};

function formatShortDate(value: string, locale: string) {
  const parsed = new Date(`${value}T00:00:00`);
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

export function ReportsSalesTrendChart({
  points,
  numberLocale,
  storeCurrency,
  emptyLabel,
  labels,
}: {
  points: SalesTrendPoint[];
  numberLocale: string;
  storeCurrency: string;
  emptyLabel: string;
  labels: {
    total: string;
    avgPerDay: string;
    max: string;
    ordersSuffix: string;
    hintExplore: string;
    hintPinned: string;
    daysSuffix: string;
    peakPrefix: string;
  };
}) {
  const fmt = React.useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);

  const totalSales = React.useMemo(
    () => points.reduce((sum, p) => sum + p.salesTotal, 0),
    [points],
  );
  const avgSales = points.length > 0 ? totalSales / points.length : 0;

  const maxSales = React.useMemo(() => {
    if (points.length === 0) return 1;
    return Math.max(...points.map((p) => p.salesTotal), 1);
  }, [points]);

  const maxIndex = React.useMemo(() => {
    if (points.length === 0) return 0;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i]!.salesTotal > points[best]!.salesTotal) best = i;
    }
    return best;
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
    (value: number) => PAD.t + (1 - value / maxSales) * ih,
    [maxSales, ih],
  );

  const pathLine = React.useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => {
        const x = xForIndex(idx);
        const y = yForValue(p.salesTotal);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points, xForIndex, yForValue]);

  const pathArea = React.useMemo(() => {
    if (!pathLine || points.length === 0) return "";
    const startX = xForIndex(0);
    const endX = xForIndex(points.length - 1);
    const baseY = PAD.t + ih;
    return `${pathLine} L ${endX.toFixed(2)} ${baseY.toFixed(2)} L ${startX.toFixed(
      2,
    )} ${baseY.toFixed(2)} Z`;
  }, [pathLine, points.length, xForIndex, ih]);

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
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const safeActiveIndex = clamp(activeIndex, 0, points.length - 1);
  const activePoint = points[safeActiveIndex]!;
  const activeX = xForIndex(safeActiveIndex);
  const activeY = yForValue(activePoint.salesTotal);

  const tooltipLeftPx = containerWidth > 0 ? (activeX / CHART_W) * containerWidth : 0;
  const tooltipWidthPx =
    containerWidth > 0 ? Math.min(256, Math.max(0, containerWidth - 24)) : 256;
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{labels.total}</p>
          <p className="mt-1 font-semibold text-slate-900">
            {fmt.format(totalSales)} {storeCurrency}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{labels.avgPerDay}</p>
          <p className="mt-1 font-semibold text-slate-900">
            {fmt.format(Math.round(avgSales))} {storeCurrency}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{labels.max}</p>
          <p className="mt-1 font-semibold text-slate-900">
            {fmt.format(Math.round(points[maxIndex]?.salesTotal ?? 0))} {storeCurrency}
          </p>
        </div>
      </div>

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
        aria-label="Sales trend chart"
      >
        <div
          className="pointer-events-none absolute top-3 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur"
          style={{
            width: `${tooltipWidthPx}px`,
            left: `${tooltipCenterPx}px`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700">
                {formatShortDate(activePoint.bucketDate, numberLocale)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {fmt.format(activePoint.salesTotal)} {storeCurrency}
              </p>
            </div>
            <p className="shrink-0 text-xs text-slate-500">
              {fmt.format(activePoint.orderCount)} {labels.ordersSuffix}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {pinned ? labels.hintPinned : labels.hintExplore}
          </p>
        </div>

        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-56 w-full">
          <defs>
            <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="salesLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((t) => {
            const y = PAD.t + (1 - t) * ih;
            const value = Math.round(maxSales * t);
            return (
              <g key={t}>
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

          {pathArea ? <path d={pathArea} fill="url(#salesArea)" /> : null}
          {pathLine ? (
            <path
              d={pathLine}
              fill="none"
              stroke="url(#salesLine)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          <line
            x1={activeX}
            x2={activeX}
            y1={PAD.t}
            y2={PAD.t + ih}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <circle cx={activeX} cy={activeY} r={6} fill="#0ea5e9" opacity={0.2} />
          <circle
            cx={activeX}
            cy={activeY}
            r={3.5}
            fill="#0ea5e9"
            stroke="#0f172a"
            strokeWidth={1}
          />

          {points.map((p, idx) => {
            if (!labelIdx.has(idx)) return null;
            const x = xForIndex(idx);
            return (
              <text
                key={p.bucketDate}
                x={x}
                y={CHART_H - 16}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
              >
                {formatShortDate(p.bucketDate, numberLocale)}
              </text>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-slate-500">
        {fmt.format(points.length)} {labels.daysSuffix} • {labels.peakPrefix}{" "}
        {formatShortDate(points[maxIndex]?.bucketDate ?? points[0]!.bucketDate, numberLocale)}
      </p>
    </div>
  );
}
