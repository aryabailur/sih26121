// MapLibre v6 spawns its tile worker from a URL next to its own module, which the Next.js bundler
// does not serve. Copy the worker (and the chunk it imports) into public/ so setWorkerUrl() can find it.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dst = join(root, "public", "maplibre");
mkdirSync(dst, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(src, f), join(dst, f));
console.log("maplibre worker copied to public/maplibre");
