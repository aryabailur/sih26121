import type { NextConfig } from "next";

// All /api/* calls are proxied to the FastAPI backend so the browser only ever talks to
// one origin (works from another device on the LAN during a live demo, no CORS setup).
const BACKEND = process.env.NWIS_BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};

export default nextConfig;
