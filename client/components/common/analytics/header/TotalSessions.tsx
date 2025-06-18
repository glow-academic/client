/**
 * TotalSessions.tsx
 * This is used to show the total number of sessions.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface TotalSessionsProps {
  totalSessions: number;
}

export default function TotalSessions({ totalSessions }: TotalSessionsProps) {
  return (
    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Training Sessions</CardTitle>
        <MessageSquare className="h-4 w-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-700">{totalSessions}</div>
        <p className="text-xs text-green-600 mt-1">Total completed</p>
      </CardContent>
    </Card>
  );
}
