import "server-only";

const toMs = (value: number) => Number(value.toFixed(1));
const slowQueryThresholdMs = () => Number(process.env.PERF_SLOW_QUERY_MS ?? "250");

type PerfStepKind = "perf" | "db" | "auth" | "logic" | "ui" | "cache";

type PerfEntry = {
  label: string;
  durationMs: number;
  kind: PerfStepKind;
  serverTimingName?: string;
};

const sanitizeServerTimingName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "step";

function logPerfEntry(scope: string, entry: PerfEntry) {
  const fullLabel = `${scope}.${entry.label}`;
  if (entry.kind === "db") {
    const level = entry.durationMs >= slowQueryThresholdMs() ? "warn" : "info";
    console[level](`[perf][db] ${fullLabel} ${entry.durationMs}ms`);
    return;
  }

  if (entry.kind === "ui") {
    console.info(`[perf][ui] ${fullLabel} ${entry.durationMs}ms`);
    return;
  }

  if (entry.kind === "auth") {
    console.info(`[perf][auth] ${fullLabel} ${entry.durationMs}ms`);
    return;
  }

  if (entry.kind === "cache") {
    console.info(`[perf][cache] ${fullLabel} ${entry.durationMs}ms`);
    return;
  }

  console.info(`[perf] ${fullLabel} ${entry.durationMs}ms`);
}

export const isPerfEnabled = () =>
  process.env.PERF_DEBUG === "1" ||
  (process.env.NODE_ENV === "development" && process.env.PERF_DEBUG !== "0");

export async function timePerf<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!isPerfEnabled()) {
    return operation();
  }

  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const durationMs = toMs(performance.now() - startedAt);
    console.info(`[perf] ${label} ${durationMs}ms`);
  }
}

export async function timeDb<T>(
  label: string,
  query: () => Promise<T>,
): Promise<T> {
  if (!isPerfEnabled()) {
    return query();
  }

  const startedAt = performance.now();
  try {
    return await query();
  } finally {
    const durationMs = toMs(performance.now() - startedAt);
    const level = durationMs >= slowQueryThresholdMs() ? "warn" : "info";
    console[level](`[perf][db] ${label} ${durationMs}ms`);
  }
}

export function createPerfScope(scope: string, mode: "perf" | "render" = "perf") {
  const enabled = isPerfEnabled();
  const startedAt = performance.now();
  const entries: PerfEntry[] = [];

  return {
    async step<T>(
      label: string,
      operation: () => T | Promise<T>,
      options?: {
        kind?: PerfStepKind;
        serverTimingName?: string;
      },
    ): Promise<T> {
      if (!enabled) {
        return operation();
      }

      const stepStartedAt = performance.now();
      try {
        return await operation();
      } finally {
        const entry: PerfEntry = {
          label,
          durationMs: toMs(performance.now() - stepStartedAt),
          kind: options?.kind ?? "perf",
          serverTimingName: options?.serverTimingName,
        };
        entries.push(entry);
        logPerfEntry(scope, entry);
      }
    },
    mark(
      label: string,
      durationMs: number,
      options?: {
        kind?: PerfStepKind;
        serverTimingName?: string;
      },
    ) {
      if (!enabled) {
        return;
      }

      const entry: PerfEntry = {
        label,
        durationMs: toMs(durationMs),
        kind: options?.kind ?? "perf",
        serverTimingName: options?.serverTimingName,
      };
      entries.push(entry);
      logPerfEntry(scope, entry);
    },
    elapsedMs() {
      return toMs(performance.now() - startedAt);
    },
    serverTiming(options?: { includeTotal?: boolean; totalName?: string }) {
      const parts = entries.map((entry) => {
        const name = sanitizeServerTimingName(entry.serverTimingName ?? entry.label);
        return `${name};dur=${entry.durationMs}`;
      });

      if (options?.includeTotal) {
        const totalName = sanitizeServerTimingName(options.totalName ?? "total");
        parts.push(`${totalName};dur=${toMs(performance.now() - startedAt)}`);
      }

      return parts.join(", ");
    },
    entries() {
      return [...entries];
    },
    end() {
      if (!enabled) {
        return;
      }
      const durationMs = toMs(performance.now() - startedAt);
      if (mode === "render") {
        console.info(`[perf][render] ${scope} ${durationMs}ms`);
        return;
      }

      console.info(`[perf] ${scope}.total ${durationMs}ms`);
    },
  };
}
