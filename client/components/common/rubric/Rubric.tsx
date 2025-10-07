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
import RubricDetails from "./RubricDetails";
import RubricStandardGroup from "./RubricStandardGroup";
import { useRubric } from "@/lib/api/hooks/rubrics";
import { useStandardGroupsByRubricId } from "@/lib/api/hooks/standard_groups";
import { useStandardsByStandardGroupIdBatch } from "@/lib/api/hooks/standards";

export interface RubricProps {
  rubricId?: string;
}

export default function Rubric({ rubricId }: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const { effectiveProfile } = useProfile();

  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});

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

  const { data: rubric, isLoading: rubricLoading } = useRubric(rubricId!);
  const { data: standardGroups, isLoading: standardGroupsLoading } =
    useStandardGroupsByRubricId(rubricId!);
  const { data: standards, isLoading: standardsLoading } =
    useStandardsByStandardGroupIdBatch(
      standardGroups!.map((group) => group.id),
    );

  const isLoading = rubricLoading || standardGroupsLoading || standardsLoading;

  // Use default rubric for creation mode, actual rubric for edit mode
  const currentRubric = isEditMode ? rubric || defaultRubric : defaultRubric;
  const currentRubricId = isEditMode ? rubricId! : "new";

  // Determine readonly based on default rubric and role
  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!currentRubric) return true;
    if (
      currentRubric.defaultRubric &&
      effectiveProfile?.role !== "superadmin"
    ) {
      return true;
    }
    return false;
  }, [isEditMode, currentRubric, effectiveProfile?.role]);

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
    router.push("/create/rubrics");
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
