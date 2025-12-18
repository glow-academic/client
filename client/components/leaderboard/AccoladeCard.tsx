/**
 * AccoladeCard.tsx
 * A simple, reusable card to display a single achievement
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import clsx from "clsx";
import { ReactNode } from "react";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";

export interface AccoladeCardProps {
  icon: ReactNode;
  title: string;
  user: ProfileItem | null | undefined;
  details: string;
  onClick?: (() => void) | undefined;
  layoutId?: string;
  disabled?: boolean;
  "data-testid"?: string;
  gradientStartColor?: string;
  gradientEndColor?: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

export default function AccoladeCard({
  icon,
  title,
  user,
  details,
  onClick,
  layoutId,
  disabled,
  "data-testid": dataTestId,
  gradientStartColor = "rgba(59, 130, 246, 0.8)",
  gradientEndColor = "rgba(59, 130, 246, 0.8)",
}: AccoladeCardProps) {
  const asButton = !!onClick && !disabled;

  return (
    <Card
      data-testid={dataTestId}
      className={clsx(
        "h-full flex flex-col border-2 border-primary py-0",
        asButton && "cursor-pointer hover:shadow-md transition-shadow",
      )}
      onClick={asButton ? onClick : undefined}
      role={asButton ? "button" : undefined}
      tabIndex={asButton ? 0 : -1}
      onKeyDown={(e) => {
        if (asButton && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardHeader className="pb-3 p-0 px-4 pt-4">
        <div className="flex flex-row items-center justify-between">
          <div className="rounded-lg p-2 bg-muted/50">{icon}</div>
          <div className="font-semibold text-sm">{title}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 flex-1 flex flex-col items-center justify-center">
        {user ? (
          <div className="flex flex-col items-center justify-center w-full gap-2">
            <Avatar
              className="h-14 w-14 outline outline-muted-foreground flex-shrink-0 mb-2"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback>
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex flex-col items-center w-full">
              <p className="text-lg font-bold text-center truncate w-full">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-muted-foreground text-center truncate w-full">
                {details}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <p className="text-sm text-muted-foreground">No holder yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AccoladeCardSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow h-full">
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
  );
}
