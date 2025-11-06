/**
 * app/(main)/create/scenarios/s/[scenarioId]/loading.tsx
 * Loading skeleton for scenario edit page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="w-full p-6 space-y-8">
        {/* Step 1: Basic Information Card */}
        <Card>
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-8 w-64 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-11" />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Persona Selection Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Step 3: Documents Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Step 4: Parameters Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-36 mb-2" />
                <Skeleton className="h-4 w-60" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Step 5: Content Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-9 w-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
