/**
 * app/(main)/management/parameters/p/[parameterId]/loading.tsx
 * Loading skeleton for parameter edit page
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
    <div className="space-y-6 py-4 px-4">
      <div className="w-full">
        <form className="space-y-6">
          {/* Parameter Basic Information */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
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

            {/* Numerical Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-11" />
                </div>
                <Skeleton className="h-3 w-56 ml-5" />
              </div>
            </div>

            {/* Document Parameter Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-11" />
                </div>
                <Skeleton className="h-3 w-72 ml-5" />
              </div>
            </div>

            {/* Practice Parameter Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-11" />
                </div>
                <Skeleton className="h-3 w-64 ml-5" />
              </div>
            </div>
          </div>

          {/* Parameter Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Skeleton className="h-9 w-24" />
            </div>

            {/* Parameter Items Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="w-80">
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead className="w-32">
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead className="w-64">
                    <Skeleton className="h-4 w-28" />
                  </TableHead>
                  <TableHead className="w-20">
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="w-48">
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                    <TableCell className="w-80">
                      <Skeleton className="h-24 w-full" />
                    </TableCell>
                    <TableCell className="w-32">
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                    <TableCell className="w-64">
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                    <TableCell className="w-20">
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-36" />
          </div>
        </form>
      </div>
    </div>
  );
}

