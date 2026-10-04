import { cn } from "./cn";

export function EmptyState({ icon = "🕹️", title, children, className }: { icon?: string; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[22px] border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>
      <p className="font-display text-lg font-black">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
    </div>
  );
}
