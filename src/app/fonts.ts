import localFont from "next/font/local";

/** Self-hosted fonts (no network at build time). Display: Unbounded. Body: Inter. */
export const display = localFont({
  src: "../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "200 900",
  display: "swap",
  preload: true,
});

export const body = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "100 900",
  display: "swap",
  preload: true,
});
