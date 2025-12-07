/**
 * DocumentKPI.tsx
 * Health KPI component for Document/TUS service.
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
import { Badge } from "@/components/ui/badge";
import { useChartColors } from "@/lib/utils/chartColors";
import { FileText } from "lucide-react";
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
  latency: number;
  count: number;
};

export interface DocumentKPIProps {
  ok: boolean;
  latency_ms: number;
  error: string;
  trend: TrendData[];
}

export default function DocumentKPI({
  ok,
  latency_ms,
  error,
  trend,
}: DocumentKPIProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const chartColors = useChartColors();
  const chartColor = chartColors[2]; // chart-3

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
    return {
      background: `linear-gradient(to bottom right, ${colorToRgba(chartColor, 0.1)}, ${colorToRgba(chartColor, 0.2)})`,
      borderColor: colorToRgba(chartColor, 0.3),
    };
  }, [chartColor]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Format latency
  const formatLatency = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Prepare chart data
  const chartData = trend.map((item) => ({
    date: item.date,
    uptime: item.value,
    latency: item.latency,
  }));

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col dark:bg-opacity-10"
        style={gradientStyle}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Document</CardTitle>
          <FileText className="h-4 w-4" style={{ color: chartColor }} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={ok ? "default" : "destructive"}>
              {ok ? "Healthy" : "Unhealthy"}
            </Badge>
          </div>
          <div className="text-sm" style={{ color: chartColor }}>
            {formatLatency(latency_ms)}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Upload Health Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows document upload (TUS) health metrics over time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant={ok ? "default" : "destructive"}>
                  {ok ? "Healthy" : "Unhealthy"}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Current Latency
                </div>
                <div className="text-lg font-semibold">
                  {formatLatency(latency_ms)}
                </div>
              </div>
            </div>
            {error && (
              <div className="text-sm text-destructive">
                <strong>Error:</strong> {error}
              </div>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "uptime"
                        ? `${value.toFixed(1)}%`
                        : formatLatency(value),
                      name === "uptime" ? "Uptime %" : "Latency",
                    ]}
                    labelFormatter={formatDate}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="uptime"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="uptime"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="latency"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="latency"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
