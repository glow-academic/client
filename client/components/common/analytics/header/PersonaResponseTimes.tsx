/**
 * PersonaResponseTimes.tsx
 * Fast and dumb UI component for displaying persona response times metric.
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
import { Clock } from "lucide-react";
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

import type { TrendData } from "@/lib/api/v2/schemas/base";

export interface PersonaResponseTimesProps {
  averageResponseTime: number;
  responseTimeTrend: TrendData[];
  hasDataAvailable: boolean;
  isLoading: boolean;
  isError: boolean;
  trendAnalysis: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

const COLOR_CONFIGS = {
  neutral: {
    gradient: "from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900",
    border: "border-gray-200",
    text: "text-gray-700",
    icon: "text-gray-600",
    accent: "text-gray-600",
    primary: "#6b7280",
  },
  danger: {
    gradient: "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600",
    accent: "text-red-600",
    primary: "#ef4444",
  },
  warning: {
    gradient:
      "from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "text-yellow-600",
    accent: "text-yellow-600",
    primary: "#eab308",
  },
  success: {
    gradient:
      "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
    accent: "text-green-600",
    primary: "#10b981",
  },
};

export default function PersonaResponseTimes({
  averageResponseTime,
  responseTimeTrend,
  hasDataAvailable,
  isLoading,
  isError,
  trendAnalysis,
  thresholds,
}: PersonaResponseTimesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Color config (lower is better for response times)
  const colorConfig = (() => {
    if (!hasDataAvailable) return COLOR_CONFIGS.neutral;
    if (averageResponseTime > thresholds.danger) return COLOR_CONFIGS.danger;
    if (averageResponseTime > thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  })();

  // Format response time for display
  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // UI states
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Persona Response Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-700">
            Persona Response Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700">Failed to load.</div>
        </CardContent>
      </Card>
    );
  }

  // Render
  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Persona Response Times
          </CardTitle>
          <Clock className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasDataAvailable ? formatResponseTime(averageResponseTime) : "0s"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Persona Response Time Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the persona response time over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={responseTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? formatResponseTime(value) : value,
                    name === "value" ? "Avg Response Time" : "Interactions",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colorConfig.primary}
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
