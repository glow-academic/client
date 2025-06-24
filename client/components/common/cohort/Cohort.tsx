/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useRole } from "@/contexts/role-context";
import { Cohort as CohortType, Profile } from "@/types";
import { createCohort } from "@/utils/mutations/cohorts/create-cohort";
import { updateCohort } from "@/utils/mutations/cohorts/update-cohort";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { GripVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CohortProps {
  cohortId?: string;
}

interface FormErrors {
  title?: string;
}

export default function Cohort({ cohortId }: CohortProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Role-based access control
  const { effectiveRole } = useRole();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);

  const initialFormData: Partial<CohortType> = {
    title: "",
    description: "",
    profileIds: [],
    active: true,
  };

  const [formData, setFormData] =
    useState<Partial<CohortType>>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch cohorts for the list mode
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // Load cohort data if editing
  useEffect(() => {
    const targetCohortId = cohortId || editingCohortId;
    if (targetCohortId) {
      const cohortToEdit = cohorts.find(
        (c: CohortType) => c.id === targetCohortId
      );
      if (cohortToEdit) {
        setFormData({
          title: cohortToEdit.title || "",
          description: cohortToEdit.description || "",
          profileIds: cohortToEdit.profileIds || [],
          active: cohortToEdit.active ?? true,
        });
      }
    }
  }, [cohortId, editingCohortId, cohorts]);

  // Role-based access control - check after all hooks
  if (effectiveRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access cohort management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleInputChange = (
    field: keyof Partial<CohortType>,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addProfile = (profileId: string) => {
    if (!formData.profileIds?.includes(profileId)) {
      setFormData((prev) => ({
        ...prev,
        profileIds: [...(prev.profileIds || []), profileId],
      }));
    }
  };

  const removeProfile = (profileId: string) => {
    setFormData((prev) => ({
      ...prev,
      profileIds: prev.profileIds?.filter((id) => id !== profileId) || [],
    }));
  };

  const handleDragStart = (e: React.DragEvent, profileId: string) => {
    setDraggedProfile(profileId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetProfileId: string) => {
    e.preventDefault();

    if (!draggedProfile) return;

    const newOrder = [...(formData.profileIds || [])];
    const draggedIndex = newOrder.findIndex((id) => id === draggedProfile);
    const targetIndex = newOrder.findIndex((id) => id === targetProfileId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed!);

      setFormData((prev) => ({ ...prev, profileIds: newOrder }));
    }

    setDraggedProfile(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = "Title is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingCohortId(null);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        result = await updateCohort(targetCohortId, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        result = await createCohort({
          title: formData.title || "",
          description: formData.description || "",
          profileIds: formData.profileIds || [],
          active: formData.active || true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!result) {
        toast.error("Failed to create cohort");
        return;
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      toast.success(
        targetCohortId
          ? "Cohort updated successfully!"
          : "Cohort created successfully!"
      );
      router.push(`/management/cohorts`);
    } catch (error) {
      const targetCohortId = cohortId || editingCohortId;
      toast.error(
        `Failed to ${targetCohortId ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Cohort Information */}

        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Enter cohort title"
            className={errors.title ? "border-destructive" : ""}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ""}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter cohort description (optional)"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="profiles">Members</Label>
            </div>
            <div className="flex gap-2">
              <Select
                value=""
                onValueChange={(value: string) => {
                  if (value) addProfile(value);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter(
                      (profile: Profile) =>
                        !formData.profileIds?.includes(profile.id)
                    )
                    .map((profile: Profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.firstName} {profile.lastName} ({profile.alias})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.profileIds?.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No members selected</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {formData.profileIds?.map((profileId) => {
                const profile = profiles.find(
                  (p: Profile) => p.id === profileId
                );
                if (!profile) return null;

                return (
                  <Card
                    key={profileId}
                    className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedProfile === profileId ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, profileId)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, profileId)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">
                          {profile.firstName} {profile.lastName}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeProfile(profileId)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {profile.alias}
                        </p>

                        <Badge
                          className={`text-xs ${
                            profile.role === "admin"
                              ? "bg-red-100 text-red-800"
                              : profile.role === "instructor"
                                ? "bg-blue-100 text-blue-800"
                                : profile.role === "ta"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {profile.role
                            ? profile.role.charAt(0).toUpperCase() +
                              profile.role.slice(1)
                            : "No Role"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {cohortId || editingCohortId ? "Updating..." : "Creating..."}
              </>
            ) : cohortId || editingCohortId ? (
              "Update Cohort"
            ) : (
              "Create Cohort"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
