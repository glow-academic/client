import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FooterSkeleton() {
  return (
    <div className="pb-8">
      <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
        {[0, 1].map((column) => (
          <div
            key={`footer-column-${column}`}
            className="flex flex-col space-y-4"
          >
            <Card className="min-h-[500px] max-h-[500px]">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full rounded-xl" />
              </CardContent>
            </Card>

            <div className="flex justify-center gap-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton
                  key={`footer-indicator-${column}-${index}`}
                  className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
