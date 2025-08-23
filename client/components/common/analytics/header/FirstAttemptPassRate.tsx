/**
 * FirstAttemptPassRate.tsx
 * This component displays the first attempt pass rate for the agents.
 * @AshokSaravanan222 & @siladiea
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

import { useAnalytics } from "@/contexts/analytics-context";
import { getAnalyticsDashboard } from "@/utils/api/analytics/get-dashboard";
import { Award } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface FirstAttemptPassRateProps {
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

export default function FirstAttemptPassRate({
  thresholds,
}: FirstAttemptPassRateProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  const [serverResult, setServerResult] = useState<{
    currentValue: number;
    trendData: Array<{ date: string; value: number; count: number }>;
    hasData: boolean;
  } | null>(null);

  const localResult = useMemo(
    () => ({ currentValue: 0, trendData: [], hasData: false }),
    []
  );

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        const data = await getAnalyticsDashboard(
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            cohortIds: selectedCohortIds,
            roles: selectedRoles,
            simulationFilters,
          },
          [{ name: "calculateFirstAttemptPassRate" }]
        );
        if (!aborted) {
          const payload = (data.results["calculateFirstAttemptPassRate"] as {
            currentValue: number;
            trendData: Array<{ date: string; value: number; count: number }>;
            hasData: boolean;
          }) ?? {
            currentValue: 0,
            trendData: [],
            hasData: false,
          };
          setServerResult(payload);
        }
      } catch {
        if (!aborted) setServerResult(null);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters]);

  const firstAttemptResult = serverResult ?? localResult;

  const {
    currentValue: firstAttemptPassRate,
    trendData: passRateTrend,
    hasData: hasDataAvailable,
  } = firstAttemptResult;

  // Determine color based on pass rate and thresholds
  const getColorConfig = (rate: number) => {
    if (!hasDataAvailable) return COLOR_CONFIGS.neutral;
    if (rate < thresholds.danger) return COLOR_CONFIGS.danger;
    if (rate < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(firstAttemptPassRate);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasDataAvailable || passRateTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = passRateTrend.slice(-3);
    const earlierData = passRateTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.value, 0) / recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.value, 0) / earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      passRateTrend.length <= 7
        ? "3 days"
        : passRateTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `First attempt pass rate ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            First Attempt Pass Rate
          </CardTitle>
          <Award className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasDataAvailable ? `${firstAttemptPassRate}%` : "0%"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>First Attempt Pass Rate Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the first attempt pass rate over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={passRateTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? `${value}%` : value,
                    name === "value" ? "Pass Rate" : "Total First Attempts",
                  ]}
                />
                <Bar
                  dataKey="value"
                  fill={colorConfig.primary}
                  name="value"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Dynamic Trend Analysis */}
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
