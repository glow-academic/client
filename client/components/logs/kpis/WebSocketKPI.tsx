/**
 * WebSocketKPI.tsx
 * Health KPI component for WebSocket service.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wifi } from "lucide-react";
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
  latency: number;
  count: number;
};

export interface WebSocketKPIProps {
  ok: boolean;
  latency_ms: number;
  error: string;
  trend: TrendData[];
}

const COLOR_CONFIG = {
  gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
  border: "border-blue-200",
  text: "text-blue-700",
  icon: "text-blue-600",
  primary: "#3b82f6",
};

export default function WebSocketKPI({
  ok,
  latency_ms,
  error,
  trend,
}: WebSocketKPIProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        className={`bg-gradient-to-br ${COLOR_CONFIG.gradient} ${COLOR_CONFIG.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">WebSocket</CardTitle>
          <Wifi className={`h-4 w-4 ${COLOR_CONFIG.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={ok ? "default" : "destructive"}>
              {ok ? "Healthy" : "Unhealthy"}
            </Badge>
          </div>
          <div className={`text-sm ${COLOR_CONFIG.text}`}>
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
                    stroke={COLOR_CONFIG.primary}
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
