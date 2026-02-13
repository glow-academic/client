import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const HEADER_CARD_COUNT = 5;

export default function HeaderSkeleton() {
  return (
    <section className="space-y-4">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${HEADER_CARD_COUNT}, minmax(0, 1fr))`,
          gridAutoRows: "1fr",
        }}
      >
        {Array.from({ length: HEADER_CARD_COUNT }).map((_, index) => (
          <Card key={`header-card-${index}`} className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={`header-indicator-${index}`}
            className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
          />
        ))}
      </div>
    </section>
  );
}
