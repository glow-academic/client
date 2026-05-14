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
import RedisKPI from "./kpis/RedisKPI";
import WebSocketKPI from "./kpis/WebSocketKPI";

import type { HealthBundleOut } from "@/app/(main)/health/page";
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
  bundleData: HealthBundleOut;
}

/** KPI shape consumed by the per-service cards. Derived client-side
 *  from ``views.service_hourly`` — the BE returns per-(service, hour)
 *  rows; we bucket by service, use the latest row as the headline,
 *  and the rest as the sparkline trend. */
type ServiceKPI = {
  ok: boolean;
  latency_ms: number;
  error: string;
  trend: { date: string; value: number; latency: number; count: number }[];
};

/** KPI slots → the lowercase ``service`` string the BE writes for
 *  that slot. The render block keys cards on the FE-facing slot name
 *  (``authentication``, etc.); the BE-facing name is what we match
 *  against ``service_hourly[i].service``.
 *
 *  The BE health watchdog (``infra/health/checks.py:run_service_checks``)
 *  emits exactly: ``database``, ``websocket``, ``redis``, ``keycloak``.
 *  ``keycloak`` is the auth provider — surfaced under the
 *  ``authentication`` slot for human-readable card labelling. */
const KPI_SLOT_TO_SERVICE: Record<
  "websocket" | "redis" | "database" | "authentication",
  string
> = {
  websocket: "websocket",
  redis: "redis",
  database: "database",
  authentication: "keycloak",
};

export default function Logs({ bundleData: serverBundleData }: LogsProps) {
  // Extract the two raw views from the bundle. The BE returns hourly
  // per-service health entries + hourly metrics aggregates; the FE
  // does the presentation-shape derivation below so the BE response
  // stays a thin projection of the underlying MVs.
  const serviceHourly = useMemo(
    () => serverBundleData?.views?.service_hourly ?? [],
    [serverBundleData],
  );
  const metricsHourly = useMemo(
    () => serverBundleData?.views?.metrics_hourly ?? [],
    [serverBundleData],
  );

  // Get chart colors from design system
  const chartColors = useChartColors();

  /**
   * Derive the 5 KPI cards from ``service_hourly`` rows.
   *
   * For each known service:
   *   - Filter rows by ``service`` (lowercase).
   *   - Sort by ``date_hour`` DESC.
   *   - Latest row becomes the headline (``ok``, ``latency_ms``, ``error``).
   *   - Older rows become the sparkline trend (oldest → newest).
   *
   * Services with no rows are absent from the map — the JSX block
   * below renders each card only when its key exists.
   */
  const healthKPIs = useMemo(() => {
    const result: Partial<
      Record<keyof typeof KPI_SLOT_TO_SERVICE, ServiceKPI>
    > = {};
    for (const slot of Object.keys(KPI_SLOT_TO_SERVICE) as Array<
      keyof typeof KPI_SLOT_TO_SERVICE
    >) {
      const beService = KPI_SLOT_TO_SERVICE[slot];
      const rows = serviceHourly
        .filter((r) => (r.service ?? "").toLowerCase() === beService)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.date_hour ?? 0).getTime() -
            new Date(a.date_hour ?? 0).getTime(),
        );
      const latest = rows[0];
      if (!latest) continue;
      result[slot] = {
        ok: latest.latest_ok ?? false,
        latency_ms: latest.avg_latency_ms ?? 0,
        error: latest.latest_error ?? "",
        trend: rows
          .slice(1)
          .reverse()
          .map((r) => ({
            date: typeof r.date_hour === "string" ? r.date_hour : "",
            value: r.uptime_percent ?? 0,
            latency: r.avg_latency_ms ?? 0,
            count: r.check_count ?? 0,
          })),
      };
    }
    return result;
  }, [serviceHourly]);

  /**
   * Map hourly metrics rows to chart points. The BE aggregates over
   * the hour bucket — we use ``avg_*`` for the smooth lines and the
   * ``max_*`` totals for request/error counters (a count's "average"
   * doesn't make sense; the hourly peak is the meaningful figure).
   * Memory is converted bytes → MB to match the chart's Y-axis label.
   */
  const metricsChartData = useMemo(
    () =>
      metricsHourly.map((m) => ({
        date: typeof m.date_hour === "string" ? m.date_hour : "",
        cpu: m.avg_cpu_percent ?? 0,
        latency: m.avg_latency_ms ?? 0,
        memory: (m.avg_memory_bytes ?? 0) / 1024 / 1024,
        requests: m.max_requests_total ?? 0,
        errors: m.max_errors_total ?? 0,
      })),
    [metricsHourly],
  );

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-7rem)]" data-page="logs-dashboard">
      {/* Top Section - 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthKPIs && (
          <>
            {healthKPIs.websocket && (
              <WebSocketKPI
                ok={healthKPIs.websocket.ok ?? false}
                latency_ms={healthKPIs.websocket.latency_ms ?? 0}
                error={healthKPIs.websocket.error ?? ""}
                trend={(healthKPIs.websocket.trend || []).map((t) => ({
                  date: t.date ?? "",
                  value: t.value ?? 0,
                  latency: t.latency ?? 0,
                  count: t.count ?? 0,
                }))}
              />
            )}
            {healthKPIs.redis && (
              <RedisKPI
                ok={healthKPIs.redis.ok ?? false}
                latency_ms={healthKPIs.redis.latency_ms ?? 0}
                error={healthKPIs.redis.error ?? ""}
                trend={(healthKPIs.redis.trend || []).map((t) => ({
                  date: t.date ?? "",
                  value: t.value ?? 0,
                  latency: t.latency ?? 0,
                  count: t.count ?? 0,
                }))}
              />
            )}
            {healthKPIs.database && (
              <DatabaseKPI
                ok={healthKPIs.database.ok ?? false}
                latency_ms={healthKPIs.database.latency_ms ?? 0}
                error={healthKPIs.database.error ?? ""}
                trend={(healthKPIs.database.trend || []).map((t) => ({
                  date: t.date ?? "",
                  value: t.value ?? 0,
                  latency: t.latency ?? 0,
                  count: t.count ?? 0,
                }))}
              />
            )}
            {healthKPIs.authentication && (
              <AuthenticationKPI
                ok={healthKPIs.authentication.ok ?? false}
                latency_ms={healthKPIs.authentication.latency_ms ?? 0}
                error={healthKPIs.authentication.error ?? ""}
                trend={(healthKPIs.authentication.trend || []).map((t) => ({
                  date: t.date ?? "",
                  value: t.value ?? 0,
                  latency: t.latency ?? 0,
                  count: t.count ?? 0,
                }))}
              />
            )}
          </>
        )}
      </div>

      {/* Middle Section - Metrics Graph */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader>
          <CardTitle>Application Metrics</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <div className="h-full">
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
