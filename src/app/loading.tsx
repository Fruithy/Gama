import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 pt-5 sm:px-0" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="mt-4 h-[300px] rounded-[28px]" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-[164px] shrink-0 rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
