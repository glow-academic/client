/**
 * Logs.tsx
 * Interactive dashboard for logs with health KPIs and metrics graph.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { useMemo } from "react";
import AuthenticationKPI from "./kpis/AuthenticationKPI";
import DatabaseKPI from "./kpis/DatabaseKPI";
import DocumentKPI from "./kpis/DocumentKPI";
import RedisKPI from "./kpis/RedisKPI";
import WebSocketKPI from "./kpis/WebSocketKPI";

import type { LogsBundleOut } from "@/app/(main)/health/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "@/lib/utils/chartColors";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LogsProps {
  // Server-provided data (for server-side rendering)
  bundleData: LogsBundleOut;
}

export default function Logs({ bundleData: serverBundleData }: LogsProps) {
  // Extract data from bundle
  const healthKPIs = useMemo(
    () => serverBundleData?.health_kpis,
    [serverBundleData],
  );
  const metrics = useMemo(
    () => serverBundleData?.metrics || [],
    [serverBundleData],
  );

  // Get chart colors from design system
  const chartColors = useChartColors();

  // Prepare metrics chart data
  const metricsChartData = useMemo(() => {
    return metrics.map((m: LogsBundleOut["metrics"][number]) => ({
      date: m.date,
      cpu: m.cpu_percent,
      latency: m.latency_ms,
      memory: m.memory_bytes / 1024 / 1024, // Convert to MB
      requests: m.requests_total,
      errors: m.errors_total,
    }));
  }, [metrics]);

  return (
    <div className="space-y-6" data-page="logs-dashboard">
      {/* Top Section - 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {healthKPIs && (
          <>
            <WebSocketKPI
              ok={healthKPIs.websocket.ok}
              latency_ms={healthKPIs.websocket.latency_ms}
              error={healthKPIs.websocket.error}
              trend={healthKPIs.websocket.trend || []}
            />
            <RedisKPI
              ok={healthKPIs.redis.ok}
              latency_ms={healthKPIs.redis.latency_ms}
              error={healthKPIs.redis.error}
              trend={healthKPIs.redis.trend || []}
            />
            <DocumentKPI
              ok={healthKPIs.document.ok}
              latency_ms={healthKPIs.document.latency_ms}
              error={healthKPIs.document.error}
              trend={healthKPIs.document.trend || []}
            />
            <DatabaseKPI
              ok={healthKPIs.database.ok}
              latency_ms={healthKPIs.database.latency_ms}
              error={healthKPIs.database.error}
              trend={healthKPIs.database.trend || []}
            />
            <AuthenticationKPI
              ok={healthKPIs.authentication.ok}
              latency_ms={healthKPIs.authentication.latency_ms}
              error={healthKPIs.authentication.error}
              trend={healthKPIs.authentication.trend || []}
            />
          </>
        )}
      </div>

      {/* Middle Section - Metrics Graph */}
      <Card>
        <CardHeader>
          <CardTitle>Application Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(dateStr) => {
                    const date = new Date(dateStr);
                    return date.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    });
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "cpu") return [`${value.toFixed(1)}%`, "CPU"];
                    if (name === "latency")
                      return [`${value.toFixed(1)}ms`, "Latency"];
                    if (name === "memory")
                      return [`${value.toFixed(1)}MB`, "Memory"];
                    if (name === "requests")
                      return [value.toLocaleString(), "Requests"];
                    if (name === "errors")
                      return [value.toLocaleString(), "Errors"];
                    return [value, name];
                  }}
                  labelFormatter={(dateStr) => {
                    const date = new Date(dateStr);
                    return date.toLocaleString();
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cpu"
                  stroke={chartColors[0]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="cpu"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="latency"
                  stroke={chartColors[1]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="latency"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="memory"
                  stroke={chartColors[2]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="memory"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="requests"
                  stroke={chartColors[3]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="requests"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errors"
                  stroke={chartColors[4]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="errors"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
