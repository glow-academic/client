/**
 * Rubric.tsx
 * Used to create and manage rubrics - supports both creation and editing with full functionality
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/profile-context";
import {
  useRubricDetail,
  useRubricDetailDefault,
} from "@/lib/api/v2/hooks/rubrics";
import RubricDetails from "./RubricDetails";
import RubricStandardGroup from "./RubricStandardGroup";

export interface RubricProps {
  rubricId?: string;
}

export default function Rubric({ rubricId }: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const { effectiveProfile } = useProfile();

  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});

  // V2 API hooks
  const { data: rubricDetail, isLoading: isLoadingRubricDetail } =
    useRubricDetail(
      rubricId || "",
      effectiveProfile?.id || "",
      !!rubricId && isEditMode
    );

  const { data: rubricDetailDefault, isLoading: isLoadingRubricDefault } =
    useRubricDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const rubricData = isEditMode ? rubricDetail : rubricDetailDefault;
  const isLoading = isEditMode ? isLoadingRubricDetail : isLoadingRubricDefault;

  // Create a default rubric for creation mode
  const defaultRubric = {
    id: "new",
    name: "",
    description: "",
    points: 0,
    passPoints: 0,
    active: true,
    defaultRubric: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    departmentId: "",
  };

  // Transform v2 data to current rubric format
  const currentRubric = useMemo(() => {
    if (!isEditMode) return defaultRubric;
    if (!rubricData) return defaultRubric;
    return {
      id: rubricId || "new",
      name: rubricData.name,
      description: rubricData.description,
      points: rubricData.points,
      passPoints: rubricData.passPoints,
      active: rubricData.active,
      defaultRubric: rubricData.default_rubric,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      departmentId: rubricData.department_id,
    };
  }, [isEditMode, rubricData, rubricId]);

  const currentRubricId = isEditMode ? rubricId! : "new";

  // Transform v2 structure to standard groups array
  const standardGroups = useMemo(() => {
    if (!rubricData?.standard_group_ids) return [];
    return rubricData.standard_group_ids.map((groupId) => ({
      id: groupId,
      name: rubricData.standard_groups_mapping[groupId]?.name || "",
      description:
        rubricData.standard_groups_mapping[groupId]?.description || "",
      points: rubricData.standard_groups_detail[groupId]?.points || 0,
      passPoints: rubricData.standard_groups_detail[groupId]?.passPoints || 0,
      rubricId: currentRubricId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shortName: "",
    }));
  }, [rubricData, currentRubricId]);

  // Transform v2 structure to standards array
  const standards = useMemo(() => {
    if (!rubricData?.standards_mapping) return [];
    const result: Array<{
      id: string;
      name: string;
      description: string;
      points: number;
      standardGroupId: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    // Map standards to their groups
    rubricData.standard_group_ids?.forEach((groupId) => {
      const standardIds =
        rubricData.standard_groups_detail[groupId]?.standard_ids || [];
      standardIds.forEach((standardId) => {
        const standard = rubricData.standards_mapping[standardId];
        if (standard) {
          result.push({
            id: standardId,
            name: standard.name,
            description: standard.description,
            points: standard.points,
            standardGroupId: groupId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
    });

    return result;
  }, [rubricData]);

  // Determine readonly based on v2 permission flag
  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!rubricData) return true;
    return !rubricData.can_edit;
  }, [isEditMode, rubricData]);

  // Initialize open cards when standard groups load
  useEffect(() => {
    if (standardGroups) {
      const initialOpenState: Record<number, boolean> = {};
      standardGroups.forEach((_, index) => {
        initialOpenState[index] = true;
      });
      setOpenCards(initialOpenState);
    }
  }, [standardGroups]);

  // Helper functions
  const toggleCard = (index: number) => {
    setOpenCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Event handlers
  const handleCancel = () => {
    router.push("/management/rubrics");
  };

  // Loading state
  if (isLoading && isEditMode) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state for edit mode when rubric not found
  if (isEditMode && !isLoading && !rubric) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Not Found</h1>
          <p className="text-muted-foreground">
            The rubric you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={handleCancel}>Back to Rubrics</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rubric Header - Use RubricDetails component for both create and edit modes */}
      <RubricDetails
        rubric={currentRubric}
        rubricId={currentRubricId}
        departmentMapping={rubricData?.department_mapping || {}}
        validDepartmentIds={rubricData?.valid_department_ids || []}
        isCreateMode={!isEditMode}
        isReadonly={isReadonly}
      />

      {/* Standard Groups - Only show in edit mode */}
      {isEditMode && (
        <div className="space-y-6">
          {/* Existing Standard Groups */}
          {standardGroups?.map((group, index) => (
            <RubricStandardGroup
              key={group.id}
              group={group}
              standards={standards || []}
              rubricId={currentRubricId}
              index={index}
              isOpen={openCards[index] ?? false}
              onToggle={toggleCard}
              mode="edit"
            />
          ))}

          {/* Add New Standard Group */}
          <RubricStandardGroup
            rubricId={currentRubricId}
            index={standardGroups?.length || 0}
            isOpen={true}
            onToggle={() => {}} // No toggle needed for create mode
            mode="create"
            standards={[]} // Pass empty array for create mode
          />
        </div>
      )}
    </div>
  );
}
