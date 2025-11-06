/**
 * app/(main)/analytics/reports/p/[profileId]/loading.tsx
 * Loading skeleton for individual report page
 * Similar to dashboard but with profile header
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 outline outline-muted-foreground">
              <AvatarFallback>
                <Skeleton className="h-10 w-10 rounded-full" />
              </AvatarFallback>
            </Avatar>
            <div>
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Header Metrics with Carousel */}
      <div className="space-y-4">
        <div className="relative group">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(5, 1fr)",
            }}
          >
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>
                    <Skeleton className="h-4 w-24" />
                  </CardTitle>
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center">
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Header carousel indicators */}
        <div className="flex justify-center gap-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-2 w-2 rounded-full" />
          ))}
        </div>
      </div>

      {/* Main Content Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch">
        {/* Primary Section */}
        <div className="flex flex-col space-y-4">
          <div className="relative group min-h-[500px] max-h-[500px]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-32" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[400px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>

          {/* Primary carousel indicators */}
          <div className="flex justify-center gap-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-full" />
            ))}
          </div>
        </div>

        {/* Secondary Section */}
        <div className="flex flex-col space-y-4">
          <div className="relative group min-h-[500px] max-h-[500px]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <Skeleton className="h-5 w-32" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[400px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>

          {/* Secondary carousel indicators */}
          <div className="flex justify-center gap-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <div className="pb-8">
        <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
          {/* Left Footer Section */}
          <div className="flex flex-col space-y-4">
            <div className="relative group min-h-[500px] max-h-[500px]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-5 w-32" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[400px] w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>

            {/* Left footer carousel indicators */}
            <div className="flex justify-center gap-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-2 w-2 rounded-full" />
              ))}
            </div>
          </div>

          {/* Right Footer Section */}
          <div className="flex flex-col space-y-4">
            <div className="relative group min-h-[500px] max-h-[500px]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-5 w-32" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[400px] w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>

            {/* Right footer carousel indicators */}
            <div className="flex justify-center gap-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-2 w-2 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Simulation History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
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
                  <Skeleton className="h-4 w-28" />
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
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
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
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
