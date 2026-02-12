"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export interface ActiveProfilesMetricProps {
  activeProfilesCount: number;
}

export default function ActiveProfilesMetric({
  activeProfilesCount,
}: ActiveProfilesMetricProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-primary/30 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Profiles</CardTitle>
        <Users className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold text-primary">
          {activeProfilesCount}
        </div>
      </CardContent>
    </Card>
  );
}
