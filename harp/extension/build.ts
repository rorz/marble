import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Bundles the HARP extension with Bun's built-in bundler — no extra toolchain.
 * TypeScript entrypoints become browser JS in `dist/`, and the static assets
 * (manifest, popup HTML/CSS) are copied alongside so `dist/` is a loadable
 * unpacked Chrome extension.
 */

const root = import.meta.dir;
const src = join(root, "src");
const dist = join(root, "dist");

await rm(dist, {
  force: true,
  recursive: true,
});
await mkdir(dist, {
  recursive: true,
});

const result = await Bun.build({
  entrypoints: [
    join(src, "background.ts"),
    join(src, "popup.ts"),
    join(src, "dashboard.ts"),
  ],
  minify: false,
  outdir: dist,
  target: "browser",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  throw new Error("HARP extension build failed");
}

await cp(join(src, "manifest.json"), join(dist, "manifest.json"));
await cp(join(src, "popup.html"), join(dist, "popup.html"));
await cp(join(src, "popup.css"), join(dist, "popup.css"));
await cp(join(src, "dashboard.html"), join(dist, "dashboard.html"));
await cp(join(src, "dashboard.css"), join(dist, "dashboard.css"));

console.log("HARP \uD83E\uDE89 extension built → harp/extension/dist/");
console.log("   Load it via chrome://extensions → Load unpacked → dist/");
