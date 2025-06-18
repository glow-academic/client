/**
 * NeedSupport.tsx
 * This is used to show the need for support.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface NeedSupportProps {
  strugglingTAs: number;
  onClick?: () => void;
}

export default function NeedSupport({
  strugglingTAs,
  onClick,
}: NeedSupportProps) {
  return (
    <Card
      className={`bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
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
  );
}
