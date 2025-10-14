/**
 * RubricDetails.tsx
 * Used to display the details for the rubric page in edit mode.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useState } from "react";
import { toast } from "sonner";

import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useCreateRubric, useUpdateRubric } from "@/lib/api/v1/hooks/rubrics";
import { Rubric as RubricType } from "@/types";
import { log } from "@/utils/logger";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";

export interface RubricDetailsProps {
  rubric: RubricType;
  rubricId: string;
  departmentMapping: Record<string, string>;
  validDepartmentIds: string[];
  isCreateMode?: boolean;
  isReadonly?: boolean;
}

export default function RubricDetails({
  rubric,
  rubricId,
  departmentMapping,
  validDepartmentIds,
  isCreateMode = false,
  isReadonly = false,
}: RubricDetailsProps) {
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // Mutation hooks
  const createRubricMutation = useCreateRubric();
  const updateRubricMutation = useUpdateRubric();
  const [formData, setFormData] = useState({
    name: rubric.name || "",
    description: rubric.description || "",
    active: rubric.active ?? true,
    points: rubric.points || 0,
    passPoints: rubric.passPoints || 0,
    departmentId:
      rubric.departmentId ||
      (effectiveProfile?.role === "superadmin"
        ? ""
        : effectiveDepartmentIds[0] || ""),
  });

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepartmentChange = (departmentId: string | null) => {
    setFormData((prev) => ({ ...prev, departmentId: departmentId || "" }));
  };

  const handleSave = async () => {
    // Department validation for superadmin
    if (effectiveProfile?.role === "superadmin" && !formData.departmentId) {
      toast.error("Department selection is required for superadmin users");
      return;
    }

    try {
      if (isCreateMode) {
        const data = await createRubricMutation.mutateAsync(formData);
        if (data && "id" in data) {
          // Redirect to the newly created rubric for editing
          router.push(`/management/rubrics/r/${data.id}`);
        }
      } else {
        await updateRubricMutation.mutateAsync({
          id: rubricId,
          ...formData,
        });
        toast.success("Rubric updated successfully");
        setIsEditing(false);
      }
    } catch (error) {
      log.error("rubric.update.failed", {
        message: "Error updating rubric",
        error,
        context: { component: "RubricDetails", rubricId },
      });
      toast.error(
        isCreateMode ? "Failed to create rubric" : "Failed to update rubric"
      );
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: rubric.name,
      description: rubric.description,
      active: rubric.active ?? true,
      points: rubric.points,
      passPoints: rubric.passPoints,
      departmentId:
        rubric.departmentId ||
        (effectiveProfile?.role === "superadmin"
          ? ""
          : effectiveDepartmentIds[0] || ""),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex-1 flex flex-col gap-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="text-2xl font-bold"
                  placeholder="Rubric Name"
                  disabled={updateRubricMutation.isPending || isReadonly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Rubric Description"
                  disabled={updateRubricMutation.isPending || isReadonly}
                />
              </div>

              {/* Department Selection - Only for superadmin */}
              {effectiveProfile?.role === "superadmin" && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <DepartmentSelector
                    departmentMapping={departmentMapping}
                    selectedDepartmentId={formData.departmentId || ""}
                    validDepartmentIds={validDepartmentIds}
                    onSelect={handleDepartmentChange}
                    placeholder="Select department"
                    disabled={updateRubricMutation.isPending || isReadonly}
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={updateRubricMutation.isPending || isReadonly}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              {!isCreateMode && (
                <div className="p-3 bg-muted/20 rounded-lg border">
                  <h4 className="text-sm font-medium mb-2">
                    Points Calculation
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Points are automatically calculated from standard groups and
                    cannot be edited directly.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      Total: {rubric.points} points
                    </Badge>
                    <Badge variant="outline">
                      Pass: {rubric.passPoints} points
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold">
                {isCreateMode ? "Create New Rubric" : rubric.name}
              </h1>
              <p className="text-muted-foreground mt-2">
                {isCreateMode
                  ? "Define the basic information for this evaluation rubric. You'll be able to add standard groups after creation."
                  : rubric.description}
              </p>
              {!isCreateMode && (
                <div className="flex gap-4 mt-2">
                  <Badge variant="outline">Total: {rubric.points} points</Badge>
                  <Badge variant="outline">
                    Pass: {rubric.passPoints} points
                  </Badge>
                  <Badge variant={rubric.active ? "default" : "secondary"}>
                    {rubric.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateRubricMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateRubricMutation.isPending || isReadonly}
                >
                  {updateRubricMutation.isPending
                    ? isCreateMode
                      ? "Creating..."
                      : "Updating..."
                    : isCreateMode
                      ? "Create Rubric"
                      : "Update"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={isReadonly}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
