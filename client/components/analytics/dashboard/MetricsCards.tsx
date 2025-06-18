/**
 * MetricsCards.tsx
 * Key metrics cards component for the dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, MessageSquare, Users } from "lucide-react";

interface MetricsCardsProps {
  totalTAs: number;
  totalSessions: number;
  avgTrainingTime: number;
  strugglingTAs: number;
}

export default function MetricsCards({
  totalTAs,
  totalSessions,
  avgTrainingTime,
  strugglingTAs,
}: MetricsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active TAs</CardTitle>
          <Users className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">{totalTAs}</div>
          <p className="text-xs text-blue-600 mt-1">
            Graduate teaching assistants
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Training Sessions
          </CardTitle>
          <MessageSquare className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700">
            {totalSessions}
          </div>
          <p className="text-xs text-green-600 mt-1">Total completed</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
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

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Need Support</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-700">
            {strugglingTAs}
          </div>
          <p className="text-xs text-orange-600 mt-1">TAs scoring below 70%</p>
        </CardContent>
      </Card>
    </div>
  );
}
