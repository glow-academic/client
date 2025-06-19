/**
 * ActiveCohorts.tsx
 * This is used to show active cohorts.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

interface ActiveCohortsProps {
  onClick?: () => void;
}

export default function ActiveCohorts({ onClick }: ActiveCohortsProps) {

  const {data: cohorts} = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const activeCohorts = cohorts?.filter((cohort) => cohort.active).length || 0;

  return (
    <Card
      className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Cohorts</CardTitle>
        <Users className="h-4 w-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-blue-700">{activeCohorts}</div>
        <p className="text-xs text-blue-600 mt-1">
          Active cohorts
        </p>
      </CardContent>
    </Card>
  );
}
