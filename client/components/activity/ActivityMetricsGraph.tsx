"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useChartColors } from "@/lib/utils/chartColors";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EventType = {
  id: string;
  name: string;
  total_count: number;
};

type ChartPoint = {
  date: string;
  event_id: string;
  count: number;
};

function CustomLineTooltip({
  active,
  payload,
  label,
  eventNames,
}: TooltipProps<number, string> & {
  eventNames: Record<string, string>;
}) {
  if (!active || !payload || !payload.length || !label) return null;

  const formatDate = (date: string) => {
    const parts = date.split("-");
    if (parts.length === 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return date;
  };

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{formatDate(label)}</div>
      <div className="mt-1 text-xs space-y-1">
        {payload.map((item, index) => {
          const dataKey = String(item.dataKey ?? "");
          const name = eventNames[dataKey] || dataKey;
          return (
            <div key={index}>
              {name}: {Math.round(Number(item.value))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ActivityMetricsGraphProps {
  chartPoints: ChartPoint[];
  availableEvents: EventType[];
  hasDataAvailable: boolean;
}

export default function ActivityMetricsGraph({
  chartPoints,
  availableEvents,
  hasDataAvailable,
}: ActivityMetricsGraphProps) {
  const chartColors = useChartColors();

  // Default: top 3 events by total_count
  const defaultSelected = useMemo(() => {
    return availableEvents
      .slice(0, 3)
      .map((e) => e.id);
  }, [availableEvents]);

  const [selectedEvents, setSelectedEvents] = useState<string[]>(defaultSelected);

  // Pivot chart points into rows: { date, [event_id]: count, ... }
  const pivotedData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    for (const point of chartPoints) {
      if (!point.date) continue;
      if (!dateMap[point.date]) {
        dateMap[point.date] = {};
      }
      dateMap[point.date]![point.event_id] = point.count;
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [chartPoints]);

  // Build mapping for GenericPicker
  const eventMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    availableEvents.forEach((event) => {
      mapping[event.id] = {
        name: event.name,
        description: `${event.total_count} events`,
      };
    });
    return mapping;
  }, [availableEvents]);

  const eventIds = useMemo(() => availableEvents.map((e) => e.id), [availableEvents]);

  // Event name lookup for tooltip
  const eventNames = useMemo(() => {
    const map: Record<string, string> = {};
    availableEvents.forEach((e) => { map[e.id] = e.name; });
    return map;
  }, [availableEvents]);

  const handleEventsSelect = (ids: string[]) => {
    if (ids.length === 0 && availableEvents.length > 0) {
      setSelectedEvents([availableEvents[0]!.id]);
      return;
    }
    // Limit to 5
    setSelectedEvents(ids.slice(0, 5));
  };

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Activity Metrics
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                Platform activity metrics over time
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" data-testid="trending-up-icon" />
              Activity Metrics
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Platform activity metrics over time
            </CardDescription>
          </div>
          <GenericPicker
            items={eventMapping}
            itemIds={eventIds}
            selectedIds={selectedEvents}
            onSelect={handleEventsSelect}
            getId={(item) => (item as unknown as { id: string }).id}
            getLabel={(item) => item.name || ""}
            getSearchText={(item) =>
              `${item.name} ${item.description || ""}`
            }
            multiSelect={true}
            placeholder="Select events..."
            hideSelectedChips={true}
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col space-y-4">
          <div
            className="flex-1 min-h-0"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 280 }
                : { minHeight: 280 }
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pivotedData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(value: string) => {
                    const parts = value.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return value;
                  }}
                />
                <YAxis className="text-xs" />
                <Tooltip
                  content={(props) => {
                    if (!props) return null;
                    return (
                      <CustomLineTooltip
                        active={props.active}
                        payload={
                          (props.payload || []) as Array<{
                            dataKey?: string;
                            value?: number;
                            name?: string;
                            color?: string;
                          }>
                        }
                        label={props.label}
                        eventNames={eventNames}
                      />
                    );
                  }}
                />
                <Legend />
                {selectedEvents.map((eventId, index) => (
                  <Line
                    key={eventId}
                    type="monotone"
                    dataKey={eventId}
                    stroke={chartColors[index % 5] || "#8884d8"}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={eventNames[eventId] || eventId}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
