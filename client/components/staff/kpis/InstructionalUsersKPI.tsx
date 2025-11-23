/**
 * InstructionalUsersKPI.tsx
 * Fast and dumb UI component for displaying instructional users metric.
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
import { Shield } from "lucide-react";
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

export interface InstructionalUsersKPIProps {
  currentValue: number;
  trendData: TrendData[];
}

const COLOR_CONFIG = {
  gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
  border: "border-blue-200",
  text: "text-blue-500",
  icon: "text-blue-500",
  primary: "#3b82f6",
};

export default function InstructionalUsersKPI({
  currentValue,
  trendData,
}: InstructionalUsersKPIProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        className={`bg-gradient-to-br ${COLOR_CONFIG.gradient} ${COLOR_CONFIG.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Instructional</CardTitle>
          <Shield className={`h-4 w-4 ${COLOR_CONFIG.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${COLOR_CONFIG.text}`}>
            {currentValue}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Instructional Users Growth Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the growth of instructional users over time.
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
                    name === "value"
                      ? "Total Instructional"
                      : "New Instructional",
                  ]}
                  labelFormatter={formatDate}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={COLOR_CONFIG.primary}
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
