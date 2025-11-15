/**
 * app/(main)/home/loading.tsx
 * Loading skeleton for home page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PROGRESS_ROWS = 5;
const CARD_COUNT = 3;
const HISTORY_ROWS = 5;

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      {/* Progress list mirrors SimulationProgress stack */}
      <section className="space-y-4">
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {Array.from({ length: PROGRESS_ROWS }).map((_, index) => (
            <div
              key={`progress-${index}`}
              className="rounded-xl border bg-card/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-56" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full rounded-full" />
                <div className="flex items-center gap-3 text-sm">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Assignments carousel */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <Card key={`card-${index}`} className="flex flex-col">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-full rounded-full" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </CardContent>
              <CardFooter className="mt-auto flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-32 rounded-lg" />
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <Skeleton
              key={`dot-${index}`}
              className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
            />
          ))}
        </div>
      </section>

      {/* History list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        <div className="rounded-xl border">
          <div className="divide-y">
            {Array.from({ length: HISTORY_ROWS }).map((_, index) => (
              <div
                key={`history-${index}`}
                className="flex flex-wrap items-center gap-4 p-4"
              >
                <div className="flex items-center gap-4 flex-1 min-w-[240px]">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
