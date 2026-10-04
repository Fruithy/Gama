import type { Metadata } from "next";
import { Settings } from "@/components/player/Settings";

export const metadata: Metadata = { title: "You", robots: { index: false } };

export default function MePage() {
  return <Settings />;
}
