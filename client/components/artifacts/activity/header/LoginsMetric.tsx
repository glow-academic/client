"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";

export interface LoginsMetricProps {
  loginsCount: number;
}

export default function LoginsMetric({
  loginsCount,
}: LoginsMetricProps) {
  return (
    <Card className="bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border-warning/30 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Logins</CardTitle>
        <LogIn className="h-4 w-4 text-warning" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold text-warning">
          {loginsCount}
        </div>
      </CardContent>
    </Card>
  );
}
