/**
 * AccoladeCard.tsx
 * A simple, reusable card to display a single achievement
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Profile } from "@/types";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ReactNode, useRef, useState } from "react";

export interface AccoladeCardProps {
  icon: ReactNode;
  title: string;
  user: Profile | null | undefined;
  details: string;
  onClick?: (() => void) | undefined;
  layoutId?: string;
  disabled?: boolean;
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
    <div className="animated-gradient-border rounded-2xl p-[1px] h-full">
      <motion.div
        ref={ref}
        layoutId={layoutId}
        className={clsx(
          "relative group rounded-2xl p-4 h-full bg-card",
          asButton && "cursor-pointer",
          "transition-shadow will-change-transform shadow-sm flex flex-col"
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
        whileHover={
          !disabled
            ? { boxShadow: "0 20px 40px rgba(0,0,0,0.12)", y: -2 }
            : undefined
        }
        whileTap={!disabled ? { scale: 0.98 } : undefined}
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
          <div className="flex items-center gap-3 w-full">
            <Avatar
              className="h-9 w-9 outline outline-muted-foreground flex-shrink-0"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback>
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold truncate">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-muted-foreground truncate">
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
