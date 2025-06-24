/**
 * ActiveCohorts.tsx
 * This is used to show active cohorts.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  active: "#10b981",
  inactive: "#ef4444",
};

export default function ActiveCohorts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const activeCohorts = cohorts?.filter((cohort) => cohort.active).length || 0;
  const inactiveCohorts =
    cohorts?.filter((cohort) => !cohort.active).length || 0;

  const chartData = [
    {
      name: "Active",
      value: activeCohorts,
      fill: COLORS.active,
    },
    {
      name: "Inactive",
      value: inactiveCohorts,
      fill: COLORS.inactive,
    },
  ].filter((item) => item.value > 0);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Cohorts</CardTitle>
          <Users className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">
            {activeCohorts}
          </div>
          <p className="text-xs text-blue-600 mt-1">Active cohorts</p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Active Cohorts Distribution</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    `${name} Cohorts`,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
