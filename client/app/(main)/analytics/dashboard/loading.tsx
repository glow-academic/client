/**
 * app/(main)/analytics/dashboard/loading.tsx
 * Loading skeleton for dashboard page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const HEADER_CARD_COUNT = 5;
const INDICATOR_PAGES = 3;
const HISTORY_ROWS = 8;

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header metrics carousel */}
      <section className="space-y-4">
        <div className="relative group">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${HEADER_CARD_COUNT}, minmax(0, 1fr))`,
              gridAutoRows: "1fr",
            }}
          >
            {Array.from({ length: HEADER_CARD_COUNT }).map((_, index) => (
              <Card key={`header-card-${index}`} className="flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-3 w-full rounded-full" />
                  <div className="flex items-center gap-2 text-xs">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-8 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Arrow placeholders */}
          <div className="pointer-events-none">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: INDICATOR_PAGES }).map((_, index) => (
            <Skeleton
              key={`header-indicator-${index}`}
              className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
            />
          ))}
        </div>
      </section>

      {/* Main content (primary + secondary carousels) */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch">
        {[0, 1].map((column) => (
          <div key={`main-column-${column}`} className="flex flex-col space-y-4">
            <div className="relative group min-h-[500px] max-h-[500px]">
              <Card className="h-full">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-72 w-full rounded-2xl" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                </CardContent>
              </Card>

              {/* Carousel arrows */}
              <div className="pointer-events-none">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={`main-indicator-${column}-${index}`}
                  className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Footer carousels */}
      <section className="pb-8">
        <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
          {[0, 1].map((column) => (
            <div key={`footer-column-${column}`} className="flex flex-col space-y-4">
              <div className="relative group min-h-[500px] max-h-[500px]">
                <Card className="h-full">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </CardContent>
                </Card>

                <div className="pointer-events-none">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Skeleton className="h-10 w-10 rounded-full shadow-lg" />
                  </div>
                </div>
              </div>

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
      </section>

      {/* Simulation history */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-12 rounded-lg" />
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <TableHead key={`head-${index}`}>
                      <Skeleton className="h-4 w-28" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: HISTORY_ROWS }).map((_, row) => (
                  <TableRow key={`row-${row}`}>
                    {Array.from({ length: 7 }).map((_, col) => (
                      <TableCell key={`cell-${row}-${col}`}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
