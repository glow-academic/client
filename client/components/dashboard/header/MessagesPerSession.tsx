/**
 * MessagesPerSession.tsx
 * Fast and dumb UI component for displaying messages per session metric.
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
import { chartColorBackground, useChartColors } from "@/lib/utils/chartColors";
import { MessageSquare } from "lucide-react";
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
  count: number;
};

export interface MessagesPerSessionProps {
  colorIndex: number;
  averageMessagesPerSession: number;
  messagesTrend: TrendData[];
  hasDataAvailable: boolean;
  trendAnalysis: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function MessagesPerSession({
  colorIndex,
  averageMessagesPerSession,
  messagesTrend,
  hasDataAvailable,
  trendAnalysis,
  status,
}: MessagesPerSessionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get chart colors and pick one based on colorIndex
  const chartColors = useChartColors();
  const chartColor = chartColors[colorIndex % 5];

  const statusDotClass =
    status === "success"
      ? "bg-success"
      : status === "warning"
        ? "bg-warning"
        : status === "danger"
          ? "bg-destructive"
          : "bg-muted-foreground";

  // Render
  return (
    <>
      <Card
        className="relative cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col"
        style={chartColorBackground(chartColor)}
        onClick={() => setIsDialogOpen(true)}
      >
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusDotClass}`} />
        <CardHeader className="pb-2 space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 shrink-0" style={{ color: chartColor }} />
            Messages Per Session
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className="text-2xl font-bold" style={{ color: chartColor }}>
            {hasDataAvailable ? `${averageMessagesPerSession}` : "0"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Messages Per Session Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the messages per session over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={messagesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => {
                    // Format YYYY-MM-DD to MM-DD
                    const parts = value.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return value;
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label: string) => {
                    // Format YYYY-MM-DD to MM-DD
                    const parts = label.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return label;
                  }}
                  formatter={(value: number, name: string) => [
                    name === "value" ? Math.round(value * 10) / 10 : value,
                    name === "value" ? "Avg Messages" : "Sessions",
                  ]}
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
