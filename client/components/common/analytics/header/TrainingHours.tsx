/**
 * TrainingHours.tsx
 * This is used to show the training hours. 
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";


interface TrainingHoursProps {
  avgTrainingTime: number;
}

export default function TrainingHours({ avgTrainingTime }: TrainingHoursProps) {
    return  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
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
  }