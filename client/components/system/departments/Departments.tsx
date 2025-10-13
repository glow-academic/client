/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { DollarSign, Edit, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDepartmentColumns } from "@/hooks/use-department-columns";
import { useDepartments } from "@/lib/api/v1/hooks/departments";
import { useModelRuns } from "@/lib/api/v1/hooks/model_runs";
import { useModels } from "@/lib/api/v1/hooks/models";
import { useProfileDepartments } from "@/lib/api/v1/hooks/profile_departments";
import { useProfiles } from "@/lib/api/v1/hooks/profiles";
import { Department, Model, ModelRun } from "@/types";
import { DepartmentsDataTable } from "./DepartmentsDataTable";

export default function Departments() {
  const router = useRouter();
  const { data: departments = [] } = useDepartments();
  const { data: profiles = [] } = useProfiles();
  const { data: profileDepartments = [] } = useProfileDepartments();
  const { data: modelRuns = [] } = useModelRuns();
  const { data: models = [] } = useModels();

  // Get table columns and filter options
  const { columns, priceSpentOptions, staffCountOptions } =
    useDepartmentColumns();

  const handleEdit = (id: string) => {
    router.push(`/system/departments/d/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Create model metadata map for pricing calculations
  const modelIdToMeta = useMemo(() => {
    const map = new Map<string, Model>();
    models.forEach((m) => map.set(m.id, m));
    return map;
  }, [models]);

  // Helper function to calculate total price spent for a department
  const calculateTotalPriceSpent = useCallback(
    (departmentId: string): number => {
      const departmentRuns = modelRuns.filter(
        (run: ModelRun) => run.departmentId === departmentId
      );

      let totalSpend = 0;
      for (const run of departmentRuns) {
        const modelId = (run as unknown as { modelId?: string | null }).modelId;
        if (!modelId) continue;

        const meta = modelIdToMeta.get(modelId);
        if (!meta) continue;

        const spend =
          (run.inputTokens / 1_000_000) * (meta.inputPpm || 0) +
          (run.outputTokens / 1_000_000) * (meta.outputPpm || 0);
        totalSpend += spend;
      }
      return totalSpend;
    },
    [modelRuns, modelIdToMeta]
  );

  // Helper function to get staff count for a department (via profile_departments junction)
  const getStaffCount = useCallback(
    (departmentId: string): number => {
      const departmentProfileLinks = profileDepartments.filter(
        (pd) => pd.departmentId === departmentId
      );
      return departmentProfileLinks.length;
    },
    [profileDepartments]
  );

  const renderDepartmentCard = (department: Department) => (
    <Card key={department.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {department.title || "Unnamed Department"}
              </CardTitle>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />$
                  {calculateTotalPriceSpent(department.id).toFixed(2)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {getStaffCount(department.id)} staff
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {department.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(department.id)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {formatDate(department.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <DepartmentsDataTable
        columns={columns}
        data={departments}
        priceSpentOptions={priceSpentOptions}
        staffCountOptions={staffCountOptions}
        renderDepartmentCard={renderDepartmentCard}
      />
    </div>
  );
}
