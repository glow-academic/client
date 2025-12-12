/**
 * TAUsersKPI.tsx
 * Fast and dumb UI component for displaying TA users metric.
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
import { useChartColors } from "@/lib/utils/chartColors";
import { User as UserIcon } from "lucide-react";
import { useMemo, useState } from "react";
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

export interface TAUsersKPIProps {
  currentValue: number;
  trendData: TrendData[];
}

export default function TAUsersKPI({
  currentValue,
  trendData,
}: TAUsersKPIProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const chartColors = useChartColors();
  const chartColor = chartColors[3]; // chart-4

  // Convert hex/rgb to rgba for gradient
  const colorToRgba = (color: string, alpha: number) => {
    if (color.startsWith("rgb")) {
      return color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
    }
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Generate gradient style from color
  const gradientStyle = useMemo(() => {
    if (!chartColor) return { background: "", borderColor: "" };
    return {
      background: `linear-gradient(to bottom right, ${colorToRgba(chartColor, 0.1)}, ${colorToRgba(chartColor, 0.2)})`,
      borderColor: colorToRgba(chartColor, 0.3),
    };
  }, [chartColor]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Render
  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col dark:bg-opacity-10"
        style={gradientStyle}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">TAs</CardTitle>
          <UserIcon className="h-4 w-4" style={{ color: chartColor }} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="text-2xl font-bold" style={{ color: chartColor }}>
            {currentValue}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>TA Users Growth Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the growth of TA users over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "value" ? Math.round(value) : value,
                    name === "value" ? "Total TAs" : "New TAs",
                  ]}
                  labelFormatter={formatDate}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="value"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
