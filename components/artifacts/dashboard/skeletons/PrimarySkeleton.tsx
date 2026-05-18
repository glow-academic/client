import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrimarySkeleton() {
  return (
    <div className="flex flex-col space-y-4">
      <Card className="min-h-[500px] max-h-[500px]">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={`primary-indicator-${index}`}
            className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
          />
        ))}
      </div>
    </div>
  );
}
