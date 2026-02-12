"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus } from "lucide-react";

export interface DraftsMetricProps {
  draftsCount: number;
}

export default function DraftsMetric({
  draftsCount,
}: DraftsMetricProps) {
  return (
    <Card className="bg-gradient-to-br from-accent/10 to-accent/5 dark:from-accent/20 dark:to-accent/10 border-accent/30 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Drafts</CardTitle>
        <FilePlus className="h-4 w-4 text-accent-foreground" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold text-accent-foreground">
          {draftsCount}
        </div>
      </CardContent>
    </Card>
  );
}
