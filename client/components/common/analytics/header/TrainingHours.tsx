/**
 * TrainingHours.tsx
 * This is used to show the training hours.
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
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  success: "#10b981",
  primary: "#3b82f6",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export default function TrainingHours() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: () => getAllSimulationChatGrades(),
  });

  const avgTrainingTime = useMemo(() => {
    if (!grades) return 0;
    return grades.length > 0
      ? Math.round(
          grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
        )
      : 45;
  }, [grades]);

  // Time distribution data
  const timeDistribution = useMemo(() => {
    if (!grades) return [];

    return [
      {
        range: "<15 min",
        count: grades.filter((g) => g.timeTaken < 900).length,
        fill: COLORS.success,
      },
      {
        range: "15-30 min",
        count: grades.filter((g) => g.timeTaken >= 900 && g.timeTaken < 1800)
          .length,
        fill: COLORS.primary,
      },
      {
        range: "30-45 min",
        count: grades.filter((g) => g.timeTaken >= 1800 && g.timeTaken < 2700)
          .length,
        fill: COLORS.warning,
      },
      {
        range: "45+ min",
        count: grades.filter((g) => g.timeTaken >= 2700).length,
        fill: COLORS.danger,
      },
    ].filter((item) => item.count > 0);
  }, [grades]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Training Hours</CardTitle>
          <Clock className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">
            {avgTrainingTime}min
          </div>
          <p className="text-xs text-purple-600 mt-1">
            Average session duration
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Training Time Distribution</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={timeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, percent }) =>
                    `${range}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {timeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Sessions"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
