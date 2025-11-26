/**
 * SessionEfficiency.tsx
 * Fast and dumb UI component for displaying session efficiency metric.
 * All data processing is handled externally via props.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendData = {
  date: string;
  value: number;
  count: number;
};

export interface SessionEfficiencyProps {
  sessionEfficiency: number;
  efficiencyTrend: TrendData[];
  hasDataAvailable: boolean;
  trendAnalysis: string | null;
  status?: "success" | "warning" | "danger" | "neutral";
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SessionEfficiency({
  sessionEfficiency,
  efficiencyTrend,
  hasDataAvailable,
  trendAnalysis,
  status,
  thresholds,
}: SessionEfficiencyProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Determine status (use prop if provided, otherwise calculate)
  const currentStatus =
    status ??
    (() => {
      if (!hasDataAvailable) return "neutral";
      if (sessionEfficiency < thresholds.danger) return "danger";
      if (sessionEfficiency < thresholds.warning) return "warning";
      return "success";
    })();

  // Get color values for Recharts
  const getChartColor = () => {
    switch (currentStatus) {
      case "success":
        return "hsl(var(--success))";
      case "warning":
        return "hsl(var(--warning))";
      case "danger":
        return "hsl(var(--destructive))";
      default:
        return "hsl(var(--muted-foreground))";
    }
  };

  const gradientClasses =
    currentStatus === "success"
      ? "bg-gradient-to-br from-success/10 to-success/5 dark:from-success/20 dark:to-success/10 border-success/30"
      : currentStatus === "warning"
        ? "bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border-warning/30"
        : currentStatus === "danger"
          ? "bg-gradient-to-br from-destructive/10 to-destructive/5 dark:from-destructive/20 dark:to-destructive/10 border-destructive/30"
          : "bg-gradient-to-br from-muted to-muted/50 dark:from-muted dark:to-muted/50 border-border";

  const textClasses =
    currentStatus === "success"
      ? "text-success"
      : currentStatus === "warning"
        ? "text-warning"
        : currentStatus === "danger"
          ? "text-destructive"
          : "text-muted-foreground";

  const iconClasses =
    currentStatus === "success"
      ? "text-success"
      : currentStatus === "warning"
        ? "text-warning"
        : currentStatus === "danger"
          ? "text-destructive"
          : "text-muted-foreground";

  // Render
  return (
    <>
      <Card
        className={`${gradientClasses} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Session Efficiency
          </CardTitle>
          <TrendingUp className={`h-4 w-4 ${iconClasses}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${textClasses}`}>
            {hasDataAvailable ? `${sessionEfficiency}%` : "0%"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Efficiency Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the session efficiency over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={efficiencyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? Math.round(value * 10) / 10 : value,
                    name === "value" ? "Efficiency" : "Sessions",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getChartColor()}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="value"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {trendAnalysis && (
            <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {trendAnalysis}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
