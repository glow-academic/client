/**
 * app/(main)/benchmark/loading.tsx
 * Loading skeleton for benchmark page
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function BenchmarkSkeleton() {
  return (
    <div className="space-y-6 px-4">
      {/* Analytics summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart area skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>

      {/* Eval history table skeleton */}
      <div className="mt-12 space-y-4">
        <Skeleton className="h-6 w-32" />
        {/* Table header */}
        <div className="flex items-center gap-4 border-b pb-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
        {/* Table rows */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
          </div>
        ))}
        {/* Pagination skeleton */}
        <div className="hidden md:flex items-center px-2">
          <div className="flex-1" />
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[70px]" />
            </div>
            <Skeleton className="h-4 w-[100px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <BenchmarkSkeleton />
    </FullPageSkeleton>
  );
}
