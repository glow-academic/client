/**
 * WebSocketKPI.tsx
 * Health KPI component for WebSocket service.
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
import { useChartColors, chartColorFallbacks } from "@/lib/utils/chartColors";
import { Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export interface WebSocketKPIProps {
  ok: boolean;
  latency_ms: number;
  error: string;
  trend: TrendData[];
}

export default function WebSocketKPI({
  ok,
  latency_ms,
  error,
  trend,
}: WebSocketKPIProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const chartColors = useChartColors();
  const chartColor = chartColors[0]; // chart-1

  // Prevent hydration mismatch by only using CSS variable colors after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Use fallback color during SSR/initial render to prevent hydration mismatch
  const displayColor = isMounted ? chartColor : chartColorFallbacks.chart1;

  // Generate gradient style from color
  const gradientStyle = useMemo(() => {
    const color = displayColor || chartColorFallbacks.chart1;
    return {
      background: `linear-gradient(to bottom right, ${colorToRgba(color, 0.1)}, ${colorToRgba(color, 0.2)})`,
      borderColor: colorToRgba(color, 0.3),
    };
  }, [displayColor]);

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
        className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col relative dark:bg-opacity-10"
        style={gradientStyle}
        onClick={() => setIsDialogOpen(true)}
      >
        <div
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-destructive"}`}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">WebSocket</CardTitle>
          <Wifi className="h-4 w-4" style={{ color: displayColor }} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="text-sm" style={{ color: displayColor }}>
            {formatLatency(latency_ms)}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>WebSocket Health Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows WebSocket health metrics over time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-destructive"}`} />
                  <span className="text-sm font-medium">{ok ? "Healthy" : "Unhealthy"}</span>
                </div>
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
                    stroke={displayColor}
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
