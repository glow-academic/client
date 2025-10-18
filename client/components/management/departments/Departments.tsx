/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { DollarSign, Edit, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { useDepartmentsList } from "@/lib/api/v2/hooks/departments";
import { DepartmentsDataTable } from "./DepartmentsDataTable";

export default function Departments() {
  const router = useRouter();
  const { effectiveProfile, departmentIds } = useProfile();

  // V2 API hook
  const filters = useMemo(
    () => ({
      departmentIds: departmentIds,
      profileId: effectiveProfile?.id || "",
    }),
    [departmentIds, effectiveProfile?.id]
  );

  const { data: departmentsData, isLoading } = useDepartmentsList(
    filters,
    !!effectiveProfile?.id && departmentIds.length > 0
  );

  // Extract data from V2 response
  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments]
  );

  // Filter options (inline)
  const priceSpentOptions = useMemo(
    () => [
      { value: "0-10", label: "$0 - $10" },
      { value: "10-50", label: "$10 - $50" },
      { value: "50-100", label: "$50 - $100" },
      { value: "100+", label: "$100+" },
    ],
    []
  );

  const staffCountOptions = useMemo(
    () => [
      { value: "1-5", label: "1-5 staff" },
      { value: "6-10", label: "6-10 staff" },
      { value: "11-20", label: "11-20 staff" },
      { value: "20+", label: "20+ staff" },
    ],
    []
  );

  const handleEdit = (id: string) => {
    router.push(`/management/departments/d/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderDepartmentCard = (department: (typeof departments)[0]) => (
    <Card
      key={department.department_id}
      className="hover:shadow-md transition-shadow"
    >
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
                  {department.total_price_spent.toFixed(2)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {department.staff_count} staff
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
              onClick={() => handleEdit(department.department_id)}
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
            {formatDate(department.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading departments...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DepartmentsDataTable
        data={departments}
        priceSpentOptions={priceSpentOptions}
        staffCountOptions={staffCountOptions}
        renderDepartmentCard={renderDepartmentCard}
      />
    </div>
  );
}
