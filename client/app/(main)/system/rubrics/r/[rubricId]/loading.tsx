/**
 * app/(main)/engine/rubrics/r/[rubricId]/loading.tsx
 * Loading skeleton for rubric edit page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Rubric Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="flex gap-4 mt-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full" />
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-11" />
                </div>
                <Skeleton className="h-3 w-64 ml-5" />
              </div>
            </div>

            {/* Points Calculation Info */}
            <div className="p-3 bg-muted/20 rounded-lg border">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-96 mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Standard Groups - Multiple collapsible cards */}
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-5 w-5" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Standard Group Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>

                {/* Standards Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Skeleton className="h-4 w-24" />
                        </TableHead>
                        <TableHead>
                          <Skeleton className="h-4 w-32" />
                        </TableHead>
                        <TableHead>
                          <Skeleton className="h-4 w-20" />
                        </TableHead>
                        <TableHead>
                          <Skeleton className="h-4 w-16" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(2)].map((_, j) => (
                        <TableRow key={j}>
                          <TableCell>
                            <Skeleton className="h-10 w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-20 w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-10 w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add New Standard Group Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-48" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
