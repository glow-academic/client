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
import { updateRubric } from "@/utils/mutations/rubrics/update-rubric";
import { Edit } from "lucide-react";

interface RubricDetailsProps {
  rubric: RubricType;
  rubricId: string;
}

export default function RubricDetails({
  rubric,
  rubricId,
}: RubricDetailsProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: rubric.name || "",
    description: rubric.description || "",
    active: rubric.active ?? true,
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RubricType> }) =>
      updateRubric(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubric", rubricId] });
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      toast.success("Rubric updated successfully");
      setIsEditing(false);
    },
    onError: (error) => {
      logError("Error updating rubric:", error);
      toast.error("Failed to update rubric");
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
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="text-2xl font-bold"
                    placeholder="Rubric Name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Rubric Description"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
                <div className="p-3 bg-muted/20 rounded-lg border">
                  <h4 className="text-sm font-medium mb-2">
                    Points Calculation
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Points are automatically calculated from standard groups and
                    cannot be edited directly.
                  </p>
                  <div className="flex gap-4">
                    <Badge variant="outline">
                      Total: {rubric.points} points
                    </Badge>
                    <Badge variant="outline">
                      Pass: {rubric.passPoints} points
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold">{rubric.name}</h1>
                <p className="text-muted-foreground mt-2">
                  {rubric.description}
                </p>
                <div className="flex gap-4 mt-2">
                  <Badge variant="outline">Total: {rubric.points} points</Badge>
                  <Badge variant="outline">
                    Pass: {rubric.passPoints} points
                  </Badge>
                  <Badge variant={rubric.active ? "default" : "secondary"}>
                    {rubric.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Update</Button>
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
