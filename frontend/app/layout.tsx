import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "NWIS — Nearby Wells Intelligence System",
  description:
    "Decision-support intelligence layer beside eRTMAC: connects the active well's depth to nearby-well history, evidence and explainable risk alerts. SIH26121 prototype (synthetic demo data).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
