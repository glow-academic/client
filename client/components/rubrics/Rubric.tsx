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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import RubricDetails from "./RubricDetails";
import RubricStandardGroup from "./RubricStandardGroup";

// Type-only import from server page
import type {
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/management/rubrics/page";
import type {
  RubricDetailDefaultOut,
  RubricDetailOut,
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/management/rubrics/r/[rubricId]/page";

type RubricItem = {
  rubric_id: string;
  name: string;
  description: string;
  department_ids: string[] | null;
  points: number;
  passPoints: number;
  can_edit: boolean;
  can_delete: boolean;
  can_duplicate: boolean;
  standard_groups: Record<string, string[]>;
};

export interface RubricProps {
  rubricId?: string;
  // Optional server-provided data (for server-side rendering)
  rubricDetail?: RubricDetailOut;
  rubricDetailDefault?: RubricDetailDefaultOut;
  // Server actions for mutations
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
}

export default function Rubric({
  rubricId,
  rubricDetail: serverRubricDetail,
  rubricDetailDefault: serverRubricDetailDefault,
  updateRubricAction,
  createRubricAction,
}: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});

  // Use server-provided data (no React Query needed when server data is provided)
  const rubricDetail = serverRubricDetail;
  const rubricDetailDefault = serverRubricDetailDefault;
  const rubricData = isEditMode ? rubricDetail : rubricDetailDefault;

  // Set breadcrumb context when rubric data is loaded
  useEffect(() => {
    if (rubricDetail?.name && rubricId && isEditMode) {
      setEntityMetadata({
        entityId: rubricId,
        entityName: rubricDetail.name,
        entityType: "rubric",
      });
    }
    return () => clearEntityMetadata();
  }, [
    rubricDetail,
    rubricId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Create a default rubric for creation mode
  const defaultRubric = useMemo(
    () => ({
      rubric_id: "new",
      name: "",
      description: "",
      points: 0,
      passPoints: 0,
      active: true,
      department_ids: [], // Default rubric has empty department_ids
      can_edit: true,
      can_delete: true,
      can_duplicate: true,
      standard_groups: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [],
  );

  // Transform v3 data to current rubric format
  const currentRubric = useMemo(() => {
    if (!isEditMode) return defaultRubric;
    if (!rubricData) return defaultRubric;
    return {
      rubric_id: rubricId || "new",
      name: rubricData.name,
      description: rubricData.description,
      points: rubricData.points,
      passPoints: rubricData.passPoints,
      active: rubricData.active,
      can_edit: rubricData.can_edit,
      can_delete: true,
      can_duplicate: true,
      standard_groups: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      department_ids: rubricData.department_ids,
    };
  }, [isEditMode, rubricData, rubricId, defaultRubric]);

  const currentRubricId = isEditMode ? rubricId! : "new";

  // Transform v3 structure to standard groups array
  const standardGroups = useMemo(() => {
    if (!rubricData?.standard_group_ids) return [];
    return rubricData.standard_group_ids.map((groupId) => {
      const groupMapping = rubricData.standard_groups_mapping[groupId];
      const groupDetail = rubricData.standard_groups_detail[groupId];
      return {
        id: groupId,
        name: groupMapping?.["name"] || "",
        description: groupMapping?.["description"] || "",
        points: groupDetail?.["points"] || 0,
        passPoints: groupDetail?.["passPoints"] || 0,
        rubricId: currentRubricId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shortName: "",
      };
    });
  }, [rubricData, currentRubricId]);

  // Transform v3 structure to standards array
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
      const groupDetail = rubricData.standard_groups_detail[groupId];
      const standardIds = groupDetail?.["standard_ids"] || [];
      standardIds.forEach((standardId) => {
        const standard = rubricData.standards_mapping[standardId];
        if (standard) {
          const name = standard["name"];
          const description = standard["description"];
          const points = standard["points"];
          if (name && typeof points === "number") {
            result.push({
              id: standardId,
              name,
              description: description || "",
              points,
              standardGroupId: groupId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });
    });

    return result;
  }, [rubricData]);

  // Determine readonly based on v3 permission flag
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

  // Error state for edit mode when rubric not found
  if (isEditMode && !rubricData) {
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
        rubric={currentRubric as RubricItem}
        rubricId={currentRubricId}
        departmentMapping={rubricData?.department_mapping || {}}
        validDepartmentIds={rubricData?.valid_department_ids || []}
        isCreateMode={!isEditMode}
        isReadonly={isReadonly}
        profileId={effectiveProfile?.id || ""}
        {...(createRubricAction && { createRubricAction })}
        {...(updateRubricAction && { updateRubricAction })}
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
              rubricName={currentRubric.name}
              rubricDescription={currentRubric.description}
              rubricDepartmentId={currentRubric.department_ids?.[0] || ""}
              rubricActive={currentRubric.active}
              profileId={effectiveProfile?.id || ""}
              {...(updateRubricAction && { updateRubricAction })}
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
            rubricName={currentRubric.name}
            rubricDescription={currentRubric.description}
            rubricDepartmentId={currentRubric.department_ids?.[0] || ""}
            rubricActive={currentRubric.active}
            profileId={effectiveProfile?.id || ""}
            {...(updateRubricAction && { updateRubricAction })}
          />
        </div>
      )}
    </div>
  );
}
