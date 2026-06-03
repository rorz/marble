import { defineConfig } from "wxt";

/**
 * HARP browser extension, built with WXT. Entrypoints live in `entrypoints/`;
 * shared, non-entrypoint modules live in `lib/`. The manifest permissions cover
 * CDP capture (`debugger`), HAR download, settings storage, and tab access; the
 * content script + host permissions let the (forthcoming) explorer probe the
 * active site in-page with the user's session.
 */
export default defineConfig({
  manifest: {
    description:
      "Reverse-engineer any site's API into a typed oRPC contract by browsing it.",
    host_permissions: [
      "<all_urls>",
    ],
    name: "HARP 🪉",
    permissions: [
      "debugger",
      "downloads",
      "storage",
      "tabs",
    ],
  },
});
