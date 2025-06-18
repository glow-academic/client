/**
 * ActiveTAs.tsx
 * This is used to show active TAs.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface ActiveTAsProps {
  totalTAs: number;
  onClick?: () => void;
}

export default function ActiveTAs({ totalTAs, onClick }: ActiveTAsProps) {
  return (
    <Card
      className={`bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
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
  );
}
