import type { NextConfig } from "next";

// All /api/* calls are proxied to the FastAPI backend so the browser only ever talks to
// one origin (works from another device on the LAN during a live demo, no CORS setup).
// Hosted (Vercel): set NWIS_BACKEND_URL to the deployed API, e.g. https://nwis-api.onrender.com —
// rewrites are fixed at build time, so redeploy after changing it.
const BACKEND = (process.env.NWIS_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

if (process.env.VERCEL && !process.env.NWIS_BACKEND_URL) {
  console.warn(
    "\n[NWIS] NWIS_BACKEND_URL is not set — /api/* will proxy to 127.0.0.1:8000, which does not exist on Vercel.\n" +
      "       Set it in Project → Settings → Environment Variables to the deployed backend URL and redeploy.\n",
  );
}

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};

export default nextConfig;
