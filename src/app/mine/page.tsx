import type { Metadata } from "next";
import { MineApp } from "@/components/mine/MineGame";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Neon Rig — idle crypto mining",
  description: "A glowing idle mining game: build rigs, seal blocks, catch whale comets and hard-fork into new neon eras. Keeps mining while you're away.",
  alternates: { canonical: "/mine" },
  openGraph: { title: `Neon Rig · ${BRAND.name}`, description: "Idle crypto mining, made of pure eye candy.", url: "/mine", type: "website" },
};

export default function MinePage() {
  return <MineApp />;
}
