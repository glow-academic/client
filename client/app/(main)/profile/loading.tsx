/**
 * app/(main)/profile/loading.tsx
 * Loading skeleton for profile page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 outline outline-muted-foreground">
              <AvatarFallback>
                <Skeleton className="h-16 w-16 rounded-full" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Skeleton className="h-8 w-48 mb-2" />
              <div className="flex items-center gap-2 mt-1">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div>
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

