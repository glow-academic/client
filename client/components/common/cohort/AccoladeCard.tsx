/**
 * AccoladeCard.tsx
 * A simple, reusable card to display a single achievement
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Profile } from "@/types";
import { ReactNode } from "react";

export interface AccoladeCardProps {
  icon: ReactNode;
  title: string;
  user: Profile | null | undefined;
  details: string;
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
}: AccoladeCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar
              className="h-9 w-9 outline outline-muted-foreground"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback>
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-bold">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-muted-foreground">{details}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No holder yet</p>
        )}
      </CardContent>
    </Card>
  );
}
