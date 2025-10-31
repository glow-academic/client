/**
 * AdminUsersKPI.tsx
 * Fast and dumb UI component for displaying admin/superadmin users metric.
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

import type { TrendData } from "@/lib/api/v2/schemas/base";

export interface AdminUsersKPIProps {
  currentValue: number;
  trendData: TrendData[];
  isLoading: boolean;
  isError: boolean;
}

const COLOR_CONFIG = {
  gradient: "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900",
  border: "border-red-200",
  text: "text-red-700",
  icon: "text-red-600",
  primary: "#ef4444",
};

export default function AdminUsersKPI({
  currentValue,
  trendData,
  isLoading,
  isError,
}: AdminUsersKPIProps) {
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

  // UI states
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Admins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-700">
            Admins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700">Failed to load.</div>
        </CardContent>
      </Card>
    );
  }

  // Render
  return (
    <>
      <Card
        className={`bg-gradient-to-br ${COLOR_CONFIG.gradient} ${COLOR_CONFIG.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Admins</CardTitle>
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
            <DialogTitle>Admin Users Growth Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the growth of admin and superadmin users over time.
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
                    name === "value" ? "Total Admins" : "New Admins",
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

