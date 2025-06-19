/**
 * TotalTAs.tsx
 * This is used to show the total number of TAs.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
};

export default function TotalTAs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Role distribution data
  const roleDistribution = useMemo(() => {
    if (!profiles) return [];

    const roles = profiles.reduce(
      (acc, profile) => {
        acc[profile.role] = (acc[profile.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(roles).map(([role, count]) => ({
      role: role.toUpperCase(),
      count,
      fill:
        role === "ta"
          ? COLORS.primary
          : role === "instructor"
            ? COLORS.success
            : COLORS.warning,
    }));
  }, [profiles]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Role Distribution</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value, "Users"]} />
                <Bar
                  dataKey="count"
                  fill={COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
