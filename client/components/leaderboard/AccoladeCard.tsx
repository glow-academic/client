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
import { motion } from "framer-motion";
import { ReactNode, useRef, useState } from "react";

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
}: AccoladeCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 10;
    const rotateX = (0.5 - y) * 10;
    ref.current.style.setProperty("--rx", `${rotateX}deg`);
    ref.current.style.setProperty("--ry", `${rotateY}deg`);
  };

  const asButton = !!onClick && !disabled;

  return (
    <div className="animated-gradient-border rounded-2xl p-[1px] h-full" data-testid={dataTestId}>
      <motion.div
        ref={ref}
        {...(layoutId && { layoutId })}
        className={clsx(
          "relative group rounded-2xl p-4 h-full bg-card",
          asButton && "cursor-pointer",
          "transition-shadow will-change-transform shadow-sm flex flex-col",
        )}
        style={{
          transform: hovering
            ? "perspective(800px) rotateX(var(--rx)) rotateY(var(--ry))"
            : undefined,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          if (ref.current) {
            ref.current.style.setProperty("--rx", "0deg");
            ref.current.style.setProperty("--ry", "0deg");
          }
        }}
        {...(!disabled && {
          whileHover: { boxShadow: "0 20px 40px rgba(0,0,0,0.12)", y: -2 },
          whileTap: { scale: 0.98 },
        })}
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
        <div className="flex flex-row items-center justify-between mb-2 text-muted-foreground">
          <div className="rounded-lg p-2 bg-muted/50">{icon}</div>
          <div className="font-semibold text-sm">{title}</div>
        </div>
        {user ? (
          <div className="flex flex-col items-center justify-center w-full gap-2 py-2">
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
      </motion.div>
    </div>
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
