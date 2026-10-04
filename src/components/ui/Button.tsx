import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-volt text-black shadow-[0_6px_0_0_#7f9a12] active:shadow-[0_2px_0_0_#7f9a12] active:translate-y-[4px]",
  secondary: "bg-surface-2 text-text border border-line-strong hover:bg-surface-3",
  ghost: "bg-transparent text-text hover:bg-white/5",
  danger: "bg-flare text-white shadow-[0_6px_0_0_#9c1d4a] active:shadow-[0_2px_0_0_#9c1d4a] active:translate-y-[4px]",
  light: "bg-white text-black shadow-[0_6px_0_0_#9a9aa6] active:shadow-[0_2px_0_0_#9a9aa6] active:translate-y-[4px]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl",
  md: "h-12 px-5 text-base rounded-2xl",
  lg: "h-14 px-6 text-lg rounded-2xl",
  xl: "h-[68px] px-8 text-2xl rounded-[24px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-display font-black uppercase tracking-tight transition disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; href: string; prefetch?: boolean }) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}
