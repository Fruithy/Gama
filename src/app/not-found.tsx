import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-[120px] font-black leading-none text-volt">404</p>
      <p className="mt-2 font-display text-2xl font-black uppercase">Missed the target.</p>
      <p className="mt-1 text-muted">This page doesn&apos;t exist. The games do.</p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-6")}>Back to the arcade</Link>
    </div>
  );
}
