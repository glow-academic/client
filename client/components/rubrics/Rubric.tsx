/**
 * Rubric.tsx
 * Implementation using modular resource components
 * Used to create and manage rubrics - supports both creation and editing
 * Follows ARTIFACT.md pattern - stores only IDs in form state, resource components handle their own data
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Points } from "@/components/resources/Points";
import { StandardGroups } from "@/components/resources/StandardGroups";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveRubricIn = InputOf<"/api/v4/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/rubrics/save", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/rubrics/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;

type RubricData = OutputOf<"/api/v4/rubrics/get", "post">;

export interface RubricProps {
  rubricId?: string;
  // Server-provided data (for server-side rendering)
  rubricData?: RubricData;
  // Server actions (replaces useMutation)
  saveRubricAction?: (input: SaveRubricIn) => Promise<SaveRubricOut>;
  patchRubricDraftAction?: (
    input: PatchRubricDraftIn
  ) => Promise<PatchRubricDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createPointsAction?: (
    input: CreateDraftPointsIn
  ) => Promise<CreateDraftPointsOut>;
  createStandardGroupsAction?: (
    input: CreateDraftStandardGroupsIn
  ) => Promise<CreateDraftStandardGroupsOut>;
}

function RubricComponent({
  rubricId,
  rubricData,
  saveRubricAction,
  patchRubricDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createDepartmentsAction,
  createFlagsAction,
  createPointsAction,
  createStandardGroupsAction,
}: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  const isGenerating = useCallback(
    (resourceType: string) =>
      generatingResources.has(resourceType as ResourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const rubricSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  const rubricDataRef = React.useRef(rubricData);
  React.useEffect(() => {
    rubricDataRef.current = rubricData;
  }, [rubricData]);

  // Memoize rubricData fields used in renderStep to prevent callback recreation
  const stableRubricDataFields = React.useMemo(() => {
    if (!rubricData) return null;
    return {
      group_id: rubricData.group_id,
      name_id: rubricData.name_id,
      name_resource: rubricData.name_resource,
      show_name: rubricData.show_name,
      name_suggestions: rubricData.name_suggestions,
      names: rubricData.names,
      name_required: rubricData.name_required,
      name_agent_id: rubricData.name_agent_id,
      description_id: rubricData.description_id,
      description_resource: rubricData.description_resource,
      show_description: rubricData.show_description,
      description_suggestions: rubricData.description_suggestions,
      description_required: rubricData.description_required,
      description_agent_id: rubricData.description_agent_id,
      descriptions: rubricData.descriptions,
      department_ids: rubricData.department_ids,
      department_resources: rubricData.department_resources,
      show_departments: rubricData.show_departments,
      department_suggestions: rubricData.department_suggestions,
      departments_required: rubricData.departments_required,
      departments_agent_id: rubricData.departments_agent_id,
      departments: rubricData.departments,
      active_flag_id: rubricData.active_flag_id,
      flag_resource: rubricData.flag_resource,
      show_flag: rubricData.show_flag,
      flag_required: rubricData.flag_required,
      flag_agent_id: rubricData.flag_agent_id,
      total_points_id: rubricData.total_points_id,
      total_points_resource: rubricData.total_points_resource,
      show_points: rubricData.show_points,
      points_agent_id: rubricData.points_agent_id,
      points_required: rubricData.points_required,
      points_suggestions: rubricData.points_suggestions,
      points: rubricData.points,
      pass_points_id: rubricData.pass_points_id,
      pass_points_resource: rubricData.pass_points_resource,
      show_pass_points: rubricData.show_pass_points,
      pass_points_agent_id: rubricData.pass_points_agent_id,
      pass_points_required: rubricData.pass_points_required,
      pass_points_suggestions: rubricData.pass_points_suggestions,
      pass_points: rubricData.pass_points,
      standard_group_ids: rubricData.standard_group_ids,
      standard_group_resources: rubricData.standard_group_resources,
      show_standard_groups: rubricData.show_standard_groups,
      standard_groups_agent_id: rubricData.standard_groups_agent_id,
      standard_groups_required: rubricData.standard_groups_required,
      standard_group_suggestions: rubricData.standard_group_suggestions,
      standard_groups: rubricData.standard_groups,
    };
  }, [rubricData]);

  const getInitialFormState = useCallback(() => {
    const data = rubricDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        department_ids: [] as string[],
        active_flag_id: null as string | null,
        total_points_id: null as string | null,
        pass_points_id: null as string | null,
        standard_group_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      department_ids: data.department_ids ?? [],
      active_flag_id: data.active_flag_id ?? null,
      total_points_id: data.total_points_id ?? null,
      pass_points_id: data.pass_points_id ?? null,
      standard_group_ids: data.standard_group_ids ?? [],
    };
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(rubricData?.department_ids ?? []),
    [rubricData?.department_ids]
  );
  const standardGroupIdsStr = React.useMemo(
    () => JSON.stringify(rubricData?.standard_group_ids ?? []),
    [rubricData?.standard_group_ids]
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        prev.total_points_id !== newState.total_points_id ||
        prev.pass_points_id !== newState.pass_points_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.standard_group_ids) !==
          JSON.stringify(newState.standard_group_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    rubricData?.name_id,
    rubricData?.description_id,
    rubricData?.active_flag_id,
    rubricData?.total_points_id,
    rubricData?.pass_points_id,
    departmentIdsStr,
    standardGroupIdsStr,
  ]);

  // Draft version tracking
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

  // Get draftId from GenericForm's URL state
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  const formDataRef = React.useRef<Record<string, unknown>>({});

  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  const patchRubricDraftActionRef = React.useRef(patchRubricDraftAction);
  React.useEffect(() => {
    patchRubricDraftActionRef.current = patchRubricDraftAction;
  }, [patchRubricDraftAction]);

  // Build a stable key for "what would we patch"
  const draftPatchKey = React.useMemo(() => {
    const pointIds = [
      formState.total_points_id,
      formState.pass_points_id,
    ].filter((id): id is string => id !== null);
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      department_ids: formState.department_ids,
      active_flag_id: formState.active_flag_id,
      point_ids: pointIds,
      standard_group_ids: formState.standard_group_ids,
    });
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formState.total_points_id,
    formState.pass_points_id,
    departmentIdsStr,
    standardGroupIdsStr,
  ]);

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.total_points_id ||
      formState.pass_points_id ||
      formState.department_ids.length > 0 ||
      formState.standard_group_ids.length > 0;

    if (!hasResourceIds || !patchRubricDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchRubricDraftActionRef.current) return;
        const pointIds = [
          formState.total_points_id,
          formState.pass_points_id,
        ].filter((id): id is string => id !== null);
        const result = await patchRubricDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            department_ids: formState.department_ids,
            active_flag_id: formState.active_flag_id,
            point_ids: pointIds.length > 0 ? pointIds : null,
            standard_group_ids: formState.standard_group_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
          setDraftId(result.draft_id);
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = rubricData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      total_points_id?: string | null;
      pass_points_id?: string | null;
      department_ids?: string[];
      standard_group_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "rubric" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "departments",
        "flags",
        "points",
        "standard_groups",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.total_points_id)
            updates.total_points_id = data.total_points_id;
          if (data.pass_points_id) updates.pass_points_id = data.pass_points_id;
          if (data.department_ids && data.department_ids.length > 0) {
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (data.standard_group_ids && data.standard_group_ids.length > 0) {
            const newGroupIds = data.standard_group_ids.filter(
              (id) => !prev.standard_group_ids.includes(id)
            );
            updates.standard_group_ids = [
              ...prev.standard_group_ids,
              ...newGroupIds,
            ];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          if (data.resource_type) {
            next.delete(data.resource_type as ResourceType);
          }
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "rubric" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      if (
        data.artifact_type !== "rubric" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: string[] = [
        "names",
        "descriptions",
        "departments",
        "flags",
        "points",
        "standard_groups",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    socket.on("rubric_generation_progress", handleGenerationProgress);
    socket.on("rubric_generation_complete", handleGenerationComplete);
    socket.on("rubric_generation_error", handleGenerationError);

    return () => {
      socket.off("rubric_generation_progress", handleGenerationProgress);
      socket.off("rubric_generation_complete", handleGenerationComplete);
      socket.off("rubric_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, rubricData?.group_id]);

  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: string[]): string | null => {
      if (resourceTypes.length === 1) {
        const agentTypeMap: Partial<Record<string, string>> = {
          names: "name",
          descriptions: "description",
          departments: "departments",
          flags: "flags",
          points: "points",
          standard_groups: "standard_groups",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType] ?? null;
        }
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: string[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt as ResourceType));
        return next;
      });

      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      socket.emit("rubric_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        rubric_id: rubricId || null,
      });
    },
    [socket, isConnected, rubricId]
  );

  // Individual generation handlers
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGeneratePoints = useCallback(
    async () =>
      handleGenerateResources(["points"], determineAgentType(["points"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateStandardGroups = useCallback(
    async () =>
      handleGenerateResources(
        ["standard_groups"],
        determineAgentType(["standard_groups"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag
  const disabled = useMemo(() => {
    if (!rubricData) return false;
    return !rubricData.can_edit;
  }, [rubricData]);

  // Set breadcrumb context when rubric data is loaded
  useEffect(() => {
    const rubricName = rubricData?.name_resource?.name;
    if (rubricName && rubricId && isEditMode) {
      setEntityMetadata({
        entityId: rubricId,
        entityName: rubricName,
        entityType: "rubric",
      });
    }
    return () => clearEntityMetadata();
  }, [
    rubricData,
    rubricId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when rubric data is loaded
  useEffect(() => {
    // Use standard_groups_agent_id as the general agent for rubrics
    if (rubricData?.standard_groups_agent_id) {
      setGenerationCapability({
        artifactType: "rubric",
        canGenerate: true,
        agentId: rubricData.standard_groups_agent_id,
      });
    } else {
      setGenerationCapability({
        artifactType: "rubric",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    rubricData?.standard_groups_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (rubricData?.name_required && !formState.name_id) {
        toast.error("Rubric name is required");
        throw new Error("Rubric name is required");
      }

      if (
        rubricData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        rubricData?.standard_groups_required &&
        (!formState.standard_group_ids ||
          formState.standard_group_ids.length === 0)
      ) {
        toast.error("Standard groups are required");
        throw new Error("Standard groups are required");
      }

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveRubricAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveRubricAction({
          body: {
            input_rubric_id: isEditMode && rubricId ? rubricId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            department_ids: formState.department_ids || [],
            active_flag_id: formState.active_flag_id || null,
            total_points_id: formState.total_points_id || null,
            pass_points_id: formState.pass_points_id || null,
            standard_group_ids: formState.standard_group_ids || [],
          },
        });
        toast.success(
          `Rubric ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/engine/rubrics");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} rubric: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      rubricId,
      effectiveProfile?.id,
      saveRubricAction,
      router,
      rubricData?.name_required,
      rubricData?.departments_required,
      rubricData?.standard_groups_required,
    ]
  );

  // Step status logic - check resource IDs
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasStandardGroups = formState.standard_group_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments
            ? "completed"
            : "active";
        case "points":
          if (!hasName) return "pending";
          return formState.total_points_id && formState.pass_points_id
            ? "completed"
            : "active";
        case "standard_groups":
          if (!hasName) return "pending";
          return hasStandardGroups ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the rubric name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "points",
        title: "Points",
        description: "Set total points and pass points for the rubric.",
        resetFields: ["total_points", "pass_points"],
      },
      {
        id: "standard_groups",
        title: "Standard Groups",
        description: "Add standard groups to organize your rubric.",
        resetFields: ["standard_group_ids"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "department_ids",
      "total_points",
      "pass_points",
      "standard_group_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "points":
        return "Points reset";
      case "standard_groups":
        return "Standard groups reset";
      default:
        return "Reset";
    }
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/rubrics",
      backLabel: "Back",
      createLabel: "Create Rubric",
      updateLabel: "Update Rubric",
    }),
    []
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (rubricData?.standard_groups_agent_id) {
        handleGenerateStandardGroups();
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [rubricData?.standard_groups_agent_id, handleGenerateStandardGroups]);

  // Render step function
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepStatus: StepStatus;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      const currentRubricData = stableRubricDataFields;
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentRubricData?.name_resource ?? null}
                  show_name={currentRubricData?.show_name ?? true}
                  name_suggestions={currentRubricData?.name_suggestions ?? []}
                  names={currentRubricData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Assessment Rubric"
                  defaultName="New Rubric"
                  required={currentRubricData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.name_agent_id ?? null}
                  createNamesAction={createNamesAction}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentRubricData?.description_resource ?? null
                  }
                  show_description={currentRubricData?.show_description ?? true}
                  description_suggestions={
                    currentRubricData?.description_suggestions ?? []
                  }
                  descriptions={currentRubricData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Rubric description"
                  required={currentRubricData?.description_required ?? false}
                  rows={3}
                  data-testid="input-rubric-description"
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentRubricData?.department_resources ?? []
                  }
                  show_departments={
                    currentRubricData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentRubricData?.department_suggestions ?? []
                  }
                  departments={currentRubricData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentRubricData?.departments_required ?? false}
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentRubricData?.flag_resource ?? null}
                  show_flag={currentRubricData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive rubrics will not be available for simulations"
                  required={currentRubricData?.flag_required ?? false}
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "points":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["total_points", "pass_points"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Points
                  points_id={formState.total_points_id ?? null}
                  points_resource={
                    currentRubricData?.total_points_resource ?? null
                  }
                  show_points={currentRubricData?.show_points ?? false}
                  points_suggestions={
                    currentRubricData?.points_suggestions ?? []
                  }
                  points={currentRubricData?.points ?? []}
                  disabled={disabled}
                  onPointsIdChange={(pointsId) =>
                    setFormState((prev) => ({
                      ...prev,
                      total_points_id: pointsId,
                    }))
                  }
                  onGenerate={handleGeneratePoints}
                  isGenerating={isGenerating("points")}
                  label="Total Points"
                  required={currentRubricData?.points_required ?? false}
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.points_agent_id ?? null}
                  createPointsAction={createPointsAction}
                />

                <Points
                  points_id={formState.pass_points_id ?? null}
                  points_resource={
                    currentRubricData?.pass_points_resource ?? null
                  }
                  show_points={currentRubricData?.show_pass_points ?? false}
                  points_suggestions={
                    currentRubricData?.pass_points_suggestions ?? []
                  }
                  points={currentRubricData?.pass_points ?? []}
                  disabled={disabled}
                  onPointsIdChange={(pointsId) =>
                    setFormState((prev) => ({
                      ...prev,
                      pass_points_id: pointsId,
                    }))
                  }
                  onGenerate={handleGeneratePoints}
                  isGenerating={isGenerating("points")}
                  label="Pass Points"
                  required={currentRubricData?.pass_points_required ?? false}
                  group_id={currentRubricData?.group_id ?? null}
                  agent_id={currentRubricData?.pass_points_agent_id ?? null}
                  createPointsAction={createPointsAction}
                />
              </div>
            </StepCard>
          );

        case "standard_groups":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["standard_group_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <StandardGroups
                standard_group_ids={formState.standard_group_ids ?? []}
                standard_group_resources={
                  currentRubricData?.standard_group_resources ?? []
                }
                show_standard_groups={
                  currentRubricData?.show_standard_groups ?? false
                }
                standard_group_suggestions={
                  currentRubricData?.standard_group_suggestions ?? []
                }
                standard_groups={currentRubricData?.standard_groups ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    standard_group_ids: ids,
                  }))
                }
                onGenerate={handleGenerateStandardGroups}
                isGenerating={isGenerating("standard_groups")}
                required={currentRubricData?.standard_groups_required ?? false}
                group_id={currentRubricData?.group_id ?? null}
                agent_id={currentRubricData?.standard_groups_agent_id ?? null}
                createStandardGroupsAction={createStandardGroupsAction}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      formState,
      disabled,
      isEditMode,
      stableRubricDataFields,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGeneratePoints,
      handleGenerateStandardGroups,
      isGenerating,
      createNamesAction,
      createDescriptionsAction,
      createDepartmentsAction,
      createFlagsAction,
      createPointsAction,
      createStandardGroupsAction,
    ]
  );

  // Initialize form callback (must be before early return)
  const initializeForm = useCallback(
    (_serverData: unknown, _isEditMode: boolean) => ({}),
    []
  );

  // Error state
  if (isEditMode && !rubricData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Not Found</h1>
          <p className="text-muted-foreground">
            The rubric you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-page={`rubric-${isEditMode ? "edit" : "new"}`}
    >
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={rubricData?.disabled_reason ?? null}
        entityType="rubric"
      />

      <GenericForm
        nuqsParsers={
          rubricSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={{}}
        setFormData={
          onFormDataChange as (
            updates: Partial<Record<string, unknown>>
          ) => void
        }
        serverData={rubricData}
        initializeForm={initializeForm}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={disabled}
        isEditMode={isEditMode}
        renderStep={renderStep}
      />
    </div>
  );
}

export default React.memo(RubricComponent, (prevProps, nextProps) => {
  // Compare rubricData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.rubricData?.name_id,
    description_id: prevProps.rubricData?.description_id,
    department_ids: prevProps.rubricData?.department_ids,
    active_flag_id: prevProps.rubricData?.active_flag_id,
    total_points_id: prevProps.rubricData?.total_points_id,
    pass_points_id: prevProps.rubricData?.pass_points_id,
    standard_group_ids: prevProps.rubricData?.standard_group_ids,
  };
  const nextIds = {
    name_id: nextProps.rubricData?.name_id,
    description_id: nextProps.rubricData?.description_id,
    department_ids: nextProps.rubricData?.department_ids,
    active_flag_id: nextProps.rubricData?.active_flag_id,
    total_points_id: nextProps.rubricData?.total_points_id,
    pass_points_id: nextProps.rubricData?.pass_points_id,
    standard_group_ids: nextProps.rubricData?.standard_group_ids,
  };

  if (
    prevProps.rubricId !== nextProps.rubricId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  return true; // Props unchanged, skip re-render
});
