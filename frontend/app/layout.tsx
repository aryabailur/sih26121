import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbm", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "NWIS — Nearby Wells Intelligence",
  description:
    "Decision-support intelligence layer beside eRTMAC: connects the active well's depth to nearby-well history, evidence and explainable risk alerts. SIH26121 prototype — illustrative demo field, proven on public well records.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#09090e" },
  ],
};

// Applied before first paint so the stored theme never flashes.
const THEME_BOOT = `try{var t=localStorage.getItem("nwis-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className={`${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
