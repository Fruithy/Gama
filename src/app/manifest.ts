import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0c",
    theme_color: "#0a0a0c",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Daily Challenge", url: "/daily" },
      { name: "My Records", url: "/records" },
    ],
  };
}
