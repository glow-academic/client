import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StepCardSkeletonProps {
  pending?: boolean;
  fields?: number;
}

export function StepCardSkeleton({
  pending = false,
  fields = 2,
}: StepCardSkeletonProps) {
  return (
    <Card
      className={cn(
        "transition-all min-w-0 max-w-full",
        pending && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-start space-y-0 pb-2 justify-between">
        <div className="flex items-start space-x-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
