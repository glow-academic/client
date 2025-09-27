/**
 * AverageScore.tsx
 * Displays the average score metric using analytics endpoint.
 * @AshokSaravanan222 & @siladiea — integrated for dataPoints/method API
 * 07/23/2025
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
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { computeCurrent, MetricResponse, TrendData, AnalyticsFilters } from "@/lib/analytics";
import {
  useAnalyticsAverageScore,
} from "@/lib/api/hooks/analytics";

export interface AverageScoreProps {
  filters: AnalyticsFilters;
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

export default function AverageScore({
  filters,
  thresholds,
}: AverageScoreProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 1) Fetch data from analytics API
  const { data, isLoading, isError } = useAnalyticsAverageScore(filters, true);

  // 2) Derive values from MetricResponse (method + dataPoints + trendData)
  const { averageScore, scoreTrend, hasDataAvailable } = useMemo(() => {
    const resp = data as MetricResponse | undefined;
    if (!resp) {
      return {
        averageScore: 0,
        scoreTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    // Use all data points for aggregate view
    const points = resp.dataPoints;

    const current = computeCurrent(resp.method, points); // returns number 0..100 for avg/rate, etc.

    // trendData already normalized by backend (MM/DD, value %, count)
    return {
      averageScore: Number.isFinite(current) ? current : 0,
      scoreTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  }, [data]);

  // 3) Color config
  const colorConfig = useMemo(() => {
    if (!hasDataAvailable) return COLOR_CONFIGS.neutral;
    if (averageScore < thresholds.danger) return COLOR_CONFIGS.danger;
    if (averageScore < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  }, [averageScore, thresholds, hasDataAvailable]);

  // 4) Trend insight (lightweight)
  const trendAnalysis = useMemo(() => {
    if (!hasDataAvailable || (scoreTrend?.length ?? 0) < 2) return null;

    const recentData = scoreTrend.slice(-3);
    const earlierData = scoreTrend.slice(0, 3);

    if (!recentData.length || !earlierData.length) return null;

    const recentAvg =
      recentData.reduce(
        (sum: number, d: TrendData) => sum + (d.value ?? 0),
        0
      ) / recentData.length;
    const earlierAvg =
      earlierData.reduce(
        (sum: number, d: TrendData) => sum + (d.value ?? 0),
        0
      ) / earlierData.length;

    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;
    if (Math.abs(changePercent) < 1) return null;

    const period =
      scoreTrend.length <= 7
        ? "3 days"
        : scoreTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";
    return `Average score ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  }, [hasDataAvailable, scoreTrend]);

  // 5) UI states
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-700">
            Average Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700">Failed to load.</div>
        </CardContent>
      </Card>
    );
  }

  // 6) Render
  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <TrendingUp className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasDataAvailable ? `${averageScore}%` : "0%"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Average Score Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the average score over time.
            </DialogDescription>
          </DialogHeader>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? `${Math.round(value)}%` : value,
                    name === "value" ? "Average Score" : "Sessions",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colorConfig.primary}
                  fill={colorConfig.primary}
                  fillOpacity={0.3}
                  name="value"
                />
              </AreaChart>
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
