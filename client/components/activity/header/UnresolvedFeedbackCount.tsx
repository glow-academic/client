/**
 * UnresolvedFeedbackCount.tsx
 * Fast and dumb UI component for displaying unresolved feedback count metric.
 * All data processing is handled externally via props.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export interface UnresolvedFeedbackCountProps {
  unresolvedFeedbackCount: number;
  hasDataAvailable: boolean;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function UnresolvedFeedbackCount({
  unresolvedFeedbackCount,
  hasDataAvailable,
  status,
}: UnresolvedFeedbackCountProps) {
  const gradientClasses =
    status === "success"
      ? "bg-gradient-to-br from-success/10 to-success/5 dark:from-success/20 dark:to-success/10 border-success/30"
      : status === "warning"
        ? "bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border-warning/30"
        : status === "danger"
          ? "bg-gradient-to-br from-destructive/10 to-destructive/5 dark:from-destructive/20 dark:to-destructive/10 border-destructive/30"
          : "bg-gradient-to-br from-muted to-muted/50 dark:from-muted dark:to-muted/50 border-border";

  const textClasses =
    status === "success"
      ? "text-success"
      : status === "warning"
        ? "text-warning"
        : status === "danger"
          ? "text-destructive"
          : "text-muted-foreground";

  const iconClasses =
    status === "success"
      ? "text-success"
      : status === "warning"
        ? "text-warning"
        : status === "danger"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <Card
      className={`${gradientClasses} h-full flex flex-col`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Unresolved Feedback</CardTitle>
        <AlertCircle className={`h-4 w-4 ${iconClasses}`} />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className={`text-2xl font-bold ${textClasses}`}>
          {hasDataAvailable ? `${unresolvedFeedbackCount}` : "0"}
        </div>
      </CardContent>
    </Card>
  );
}

