"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor } from "lucide-react";

export interface SessionsMetricProps {
  sessionsCount: number;
}

export default function SessionsMetric({
  sessionsCount,
}: SessionsMetricProps) {
  return (
    <Card className="bg-gradient-to-br from-success/10 to-success/5 dark:from-success/20 dark:to-success/10 border-success/30 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Sessions</CardTitle>
        <Monitor className="h-4 w-4 text-success" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold text-success">
          {sessionsCount}
        </div>
      </CardContent>
    </Card>
  );
}
