import type { NextConfig } from "next";
import { resolve } from "node:path";
const config: NextConfig = {
  distDir:
    process.env.NEXT_DIST_DIR ||
    (process.env.NODE_ENV === "production" ? ".next-production" : ".next"),
  turbopack: { root: resolve(process.cwd(), "..") },
  outputFileTracingRoot: resolve(process.cwd(), ".."),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://127.0.0.1:4100"}/api/:path*`,
      },
    ];
  },
};
export default config;
