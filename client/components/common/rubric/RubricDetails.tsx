/**
 * RubricDetails.tsx
 * Used to display the details for the rubric page in edit mode.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Rubric as RubricType } from "@/types";
import { logError } from "@/utils/logger";
import { createRubric } from "@/utils/mutations/rubrics/create-rubric";
import { updateRubric } from "@/utils/mutations/rubrics/update-rubric";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";

interface RubricDetailsProps {
  rubric: RubricType;
  rubricId: string;
  isCreateMode?: boolean;
}

export default function RubricDetails({
  rubric,
  rubricId,
  isCreateMode = false,
}: RubricDetailsProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: rubric.name || "",
    description: rubric.description || "",
    active: rubric.active ?? true,
    points: rubric.points || 0,
    passPoints: rubric.passPoints || 0,
  });

  const updateRubricMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<RubricType>;
    }) => {
      if (isCreateMode) {
        return await createRubric(data as Parameters<typeof createRubric>[0]);
      } else {
        return await updateRubric(id, data);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rubric", rubricId] });
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      if (isCreateMode && data && "id" in data) {
        // Redirect to the newly created rubric for editing
        router.push(`/create/rubrics/r/${data.id}`);
      } else {
        toast.success(
          isCreateMode
            ? "Rubric created successfully"
            : "Rubric updated successfully"
        );
        setIsEditing(false);
      }
    },
    onError: (error) => {
      logError("Error updating rubric:", error);
      toast.error(
        isCreateMode ? "Failed to create rubric" : "Failed to update rubric"
      );
    },
  });

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateRubricMutation.mutate({
      id: rubricId,
      data: formData,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: rubric.name,
      description: rubric.description,
      active: rubric.active ?? true,
      points: rubric.points,
      passPoints: rubric.passPoints,
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
                  disabled={updateRubricMutation.isPending}
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
                  disabled={updateRubricMutation.isPending}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={updateRubricMutation.isPending}
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
                  disabled={updateRubricMutation.isPending}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
