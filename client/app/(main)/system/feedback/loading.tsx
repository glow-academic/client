/**
 * app/(main)/system/feedback/loading.tsx
 * Loading skeleton for feedback page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
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
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2 flex-wrap">
          <div className="mb-2">
            {/* Search input */}
            <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
          </div>

          <div className="flex items-center space-x-2 flex-wrap mb-2">
            {/* Filter buttons */}
            <Skeleton className="h-8 w-[80px]" />
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-2">
          {/* Bulk Delete Button */}
          <Skeleton className="h-8 w-8" />
          {/* Refresh Button */}
          <Skeleton className="h-8 w-8" />
          {/* Column visibility */}
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="w-12">
                <Skeleton className="h-4 w-4" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(10)].map((_, i) => (
              <TableRow key={i} className="h-6">
                <TableCell className="w-12 text-center">
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell className="text-left align-top">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-8 w-[100px]" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[70px]" />
          <Skeleton className="h-8 w-[70px]" />
        </div>
      </div>
    </div>
  );
}

