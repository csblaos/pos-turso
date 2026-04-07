import "server-only";

const maskHostnameForProviders = (hostname: string) => {
  const rules: Array<{ suffix: string; masked: string }> = [
    { suffix: ".r2.cloudflarestorage.com", masked: "***.r2.cloudflarestorage.com" },
    { suffix: ".upstash.io", masked: "***.upstash.io" },
    { suffix: ".turso.io", masked: "***.turso.io" },
  ];

  const lower = hostname.toLowerCase();
  for (const rule of rules) {
    if (lower.endsWith(rule.suffix)) {
      return rule.masked;
    }
  }

  return hostname;
};

export function toSafeEndpointLabel(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed === "fromEnv") {
    return trimmed;
  }

  // Keep file targets as-is (no secrets in the path).
  if (trimmed.startsWith("file:")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol; // includes trailing :

    // Allow local targets to show fully for debugging.
    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return `${protocol}//${url.host}`;
    }

    const maskedHostname = maskHostnameForProviders(hostname);
    const hostWithPort = url.port ? `${maskedHostname}:${url.port}` : maskedHostname;
    return `${protocol}//${hostWithPort}`;
  } catch {
    return trimmed;
  }
}

