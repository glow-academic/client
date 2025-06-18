/**
 * TotalTAs.tsx
 * This is used to show the total number of TAs.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useMemo } from "react";

interface TotalTAsProps {
  onClick?: () => void;
}

export default function TotalTAs({ onClick }: TotalTAsProps) {
  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // Calculate total TAs
  const totalTAs = useMemo(() => {
    if (!profiles) return 0;
    return profiles.filter((profile) => profile.role === "ta").length;
  }, [profiles]);

  return (
    <Card
      className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total TAs</CardTitle>
        <Users className="h-4 w-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-700">{totalTAs}</div>
        <p className="text-xs text-blue-600 mt-1">Teaching assistants</p>
      </CardContent>
    </Card>
  );
}
