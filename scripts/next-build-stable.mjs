import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(cwd, "..");

const transientErrorMarkers = [
  "Cannot find module '../chunks/ssr/[turbopack]_runtime.js'",
  "Failed to collect page data",
  "PageNotFoundError",
  "ENOENT: no such file or directory, rename",
  ".next/export/500.html",
];

async function cleanNextArtifacts() {
  await rm(path.join(projectRoot, ".next"), { recursive: true, force: true });
}

function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["next", "build"],
      { cwd: projectRoot, stdio: ["inherit", "pipe", "pipe"] },
    );

    let combined = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stderr.write(chunk);
    });

    child.on("close", (code) => resolve({ code: code ?? 1, combined }));
  });
}

function looksTransient(combined) {
  return transientErrorMarkers.some((marker) => combined.includes(marker));
}

// npm lifecycle may already run `prebuild` to clean `.next`. We still keep an
// additional clean+retry here because the Turbopack runtime missing error can
// be flaky on some machines.
const first = await runNextBuild();
if (first.code === 0) {
  process.exit(0);
}

if (!looksTransient(first.combined)) {
  process.exit(first.code);
}

process.stderr.write("\n[build] Detected transient Next.js build error. Retrying once...\n\n");
await cleanNextArtifacts();
const second = await runNextBuild();
process.exit(second.code);
