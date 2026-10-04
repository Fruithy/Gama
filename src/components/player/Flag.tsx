import { countryName, flagEmoji } from "@/lib/country";

export function Flag({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return (
    <span className={className} title={countryName(code)} aria-label={countryName(code)} role="img">
      {flagEmoji(code)}
    </span>
  );
}
