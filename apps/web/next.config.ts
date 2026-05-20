import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@mariozechner/clipboard",
  ],
  transpilePackages: [
    "@marble/ui",
  ],
};

export default nextConfig;
