/**
 * app/(main)/cohorts/c/[cohortId]/loading.tsx
 * Loading skeleton for cohort view page
 * Similar to leaderboard page with accolades and table
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
      {/* Dashboard Content */}
      <div className="space-y-8">
        {/* Accolades Section */}
        <div className="relative">
          {/* Accolades Grid */}
          <div className="relative group">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Leaderboard Table Section */}
        <div className="space-y-4">
          {/* Toolbar skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2">
                {/* Search input */}
                <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Reset filter button */}
                <Skeleton className="h-8 w-20" />
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              {/* Column visibility */}
              <Skeleton className="h-8 w-8" />
            </div>
          </div>

          {/* Table skeleton */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-32" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead>
                    <Skeleton className="h-4 w-32" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(15)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2 w-[120px]">
                        <Skeleton className="h-6 w-8" />
                        {i < 3 && <Skeleton className="h-5 w-5" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                        {i === 0 && <Skeleton className="h-5 w-12 rounded-full" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

