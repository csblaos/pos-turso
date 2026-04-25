"use client";

const toMs = (value: number) => Number(value.toFixed(1));

export const isClientPerfEnabled = () =>
  process.env.NEXT_PUBLIC_PERF_DEBUG === "1" ||
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PERF_DEBUG !== "0");

export function logClientPerf(
  label: string,
  durationMs: number,
  kind: "client" | "network" | "logic" | "render" = "client",
) {
  if (!isClientPerfEnabled()) {
    return;
  }

  const prefix = kind === "client" ? "[perf][client]" : `[perf][client][${kind}]`;
  console.info(`${prefix} ${label} ${toMs(durationMs)}ms`);
}

export function logServerTimingBreakdown(label: string, serverTimingHeader: string | null) {
  if (!isClientPerfEnabled() || !serverTimingHeader) {
    return;
  }

  const entries = serverTimingHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const [namePart, ...rest] = entry.split(";");
    const metricName = namePart.trim();
    const durationPart = rest.find((segment) => segment.trim().startsWith("dur="));
    if (!metricName || !durationPart) {
      continue;
    }
    const rawDuration = Number(durationPart.trim().slice(4));
    if (!Number.isFinite(rawDuration)) {
      continue;
    }
    console.info(`[perf][client][server-timing] ${label}.${metricName} ${toMs(rawDuration)}ms`);
  }
}

export function logClientCommit(label: string, startedAt: number) {
  if (!isClientPerfEnabled()) {
    return;
  }

  window.requestAnimationFrame(() => {
    logClientPerf(label, performance.now() - startedAt, "render");
  });
}
