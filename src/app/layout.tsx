import type { Metadata, Viewport } from "next";
import "./globals.css";
import { body, display } from "./fonts";
import { BRAND } from "@/lib/brand";
import { siteUrl } from "@/lib/env";
import { PlayerProvider } from "@/components/providers/PlayerProvider";
import { AppChrome } from "@/components/nav/AppChrome";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { Footer } from "@/components/shell/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.titleSuffix}` },
  description: BRAND.description,
  applicationName: BRAND.shortName,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: BRAND.name, title: BRAND.name, description: BRAND.description },
  twitter: { card: "summary_large_image" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <PlayerProvider>
          <AppChrome />
          <main className="mx-auto min-h-[70dvh] max-w-6xl pb-[calc(84px+var(--safe-bottom))] md:pb-10">{children}</main>
          <Footer />
        </PlayerProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
