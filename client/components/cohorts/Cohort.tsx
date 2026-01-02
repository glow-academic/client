/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  PlayCircle,
  Power,
} from "lucide-react";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Import types from new page (create action)
import type {
  CohortNewOut,
  CreateCohortIn,
  CreateCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
} from "@/app/(main)/create/cohorts/new/page";
// Import types from edit page (update action)
import type {
  CohortDetailOut,
  UpdateCohortIn,
  UpdateCohortOut,
} from "@/app/(main)/create/cohorts/c/[cohortId]/page";

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortDetail?: CohortDetailOut;
  cohortDetailDefault?: CohortNewOut;
  // Server actions (replaces useMutation)
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchCohortDraftAction?: (
    input: PatchCohortDraftIn
  ) => Promise<PatchCohortDraftOut>;
}

function CohortComponent({
  cohortId,
  cohortDetail: serverCohortDetail,
  cohortDetailDefault: serverCohortDetailDefault,
  createCohortAction,
  updateCohortAction,
  patchCohortDraftAction,
}: CohortProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!cohortId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverCohortDetail | typeof serverCohortDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("cohort_id" in data && data.cohort_id) {
          return `cohort_id:${String(data.cohort_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        if ("valid_simulation_ids" in data) {
          keyFields["valid_simulation_ids"] = Array.isArray(
            data["valid_simulation_ids"]
          )
            ? data["valid_simulation_ids"].sort().join(",")
            : data["valid_simulation_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const cohortDetailId = React.useMemo(
    () => stabilizeServerProp(serverCohortDetail),
    [serverCohortDetail, stabilizeServerProp]
  );
  const cohortDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverCohortDetailDefault),
    [serverCohortDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerCohortDetailRef = React.useRef(serverCohortDetail);
  const latestServerCohortDetailDefaultRef = React.useRef(
    serverCohortDetailDefault
  );

  latestServerCohortDetailRef.current = serverCohortDetail;
  latestServerCohortDetailDefaultRef.current = serverCohortDetailDefault;

  // Use refs to track stable server props
  const stableCohortDetailRef = React.useRef<{
    data: typeof serverCohortDetail;
    id: string | null;
  }>({
    data: serverCohortDetail,
    id: cohortDetailId,
  });
  const stableCohortDetailDefaultRef = React.useRef<{
    data: typeof serverCohortDetailDefault;
    id: string | null;
  }>({
    data: serverCohortDetailDefault,
    id: cohortDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableCohortDetailRef.current.id !== cohortDetailId) {
      stableCohortDetailRef.current = {
        data: latestServerCohortDetailRef.current,
        id: cohortDetailId,
      };
    }
  }, [cohortDetailId]);

  React.useEffect(() => {
    if (stableCohortDetailDefaultRef.current.id !== cohortDetailDefaultId) {
      stableCohortDetailDefaultRef.current = {
        data: latestServerCohortDetailDefaultRef.current,
        id: cohortDetailDefaultId,
      };
    }
  }, [cohortDetailDefaultId]);

  // Use stable references
  const cohortDetail = stableCohortDetailRef.current.data;
  const cohortDetailDefault = stableCohortDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const cohortDataId = React.useMemo(() => {
    const data = isEditMode ? cohortDetail : cohortDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("cohort_id" in data && data.cohort_id) {
        return `cohort_id:${String(data.cohort_id)}`;
      }
      const keyFields: Record<string, unknown> = {};
      if ("valid_department_ids" in data) {
        keyFields["valid_department_ids"] = Array.isArray(
          data["valid_department_ids"]
        )
          ? data["valid_department_ids"].sort().join(",")
          : data["valid_department_ids"];
      }
      if ("valid_simulation_ids" in data) {
        keyFields["valid_simulation_ids"] = Array.isArray(
          data["valid_simulation_ids"]
        )
          ? data["valid_simulation_ids"].sort().join(",")
          : data["valid_simulation_ids"];
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, cohortDetail, cohortDetailDefault]);

  const stableCohortDataRef = React.useRef<{
    data: typeof cohortDetail | typeof cohortDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? cohortDetail : cohortDetailDefault,
    id: cohortDataId,
  });

  React.useEffect(() => {
    if (stableCohortDataRef.current.id !== cohortDataId) {
      stableCohortDataRef.current = {
        data: isEditMode ? cohortDetail : cohortDetailDefault,
        id: cohortDataId,
      };
    }
  }, [isEditMode, cohortDetail, cohortDetailDefault, cohortDataId]);

  const cohortData = stableCohortDataRef.current.data;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id ?? null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Inline parsers for URL-backed state (navigation/search params only)
  const cohortSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    simulationSearch: parseAsString,
    // Filter params (URL-backed)
    simulationShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(cohortSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    title: string;
    description: string;
    active: boolean;
    departmentIds: string[];
    simulationIds: string[];
    simulationActiveStates: Record<string, boolean>; // Active states for simulations
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? cohortDetail : cohortDetailDefault;
    if (!data) {
      return {
        title: "",
        description: "",
        active: true,
        departmentIds: defaultDepartmentIds || [],
        simulationIds: [],
        simulationActiveStates: {},
      };
    }

    // Initialize simulation active states from server data
    const activeStates: Record<string, boolean> = {};
    if (data.simulations) {
      data.simulations.forEach((sim) => {
        if (sim.simulation_id) {
          activeStates[sim.simulation_id] = sim.active ?? true;
        }
      });
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      title: data.title || "",
      description: data.description || "",
      active: data.active ?? true,
      departmentIds: data.department_ids || defaultDepartmentIds || [],
      simulationIds: data.simulation_ids || [],
      simulationActiveStates: activeStates,
    };
  }, [isEditMode, cohortDetail, cohortDetailDefault, defaultDepartmentIds]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      simulationSearch: urlParams.simulationSearch || null,
      simulationShowSelected: urlParams.simulationShowSelected ?? false,
    } as Record<string, unknown>;
  }, [
    draftState,
    urlParams.simulationSearch,
    urlParams.simulationShowSelected,
  ]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "title" ||
          key === "description" ||
          key === "active" ||
          key === "simulationActiveStates" ||
          key === "departmentIds" ||
          key === "simulationIds"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (key === "simulationSearch") {
          // Update URL params for search/filter operations
          urlUpdates["simulationSearch"] =
            (value as string) && (value as string).length > 0
              ? (value as string)
              : null;
        } else if (key === "simulationShowSelected") {
          // Update URL params for filter operations
          urlUpdates["simulationShowSelected"] = value === true ? true : null;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        // Check if URL params actually changed before updating
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  // Set breadcrumb context when cohort data is loaded
  useEffect(() => {
    if (cohortDetail?.title && cohortId && isEditMode) {
      setEntityMetadata({
        entityId: cohortId,
        entityName: cohortDetail.title,
        entityType: "cohort",
      });
    }
    return () => clearEntityMetadata();
  }, [
    cohortDetail,
    cohortId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Draft autosave integration
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchCohortDraftAction
      ? async (input) => {
          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchCohortDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchCohortDraftIn["body"],
          });
          // Transform response to match hook expectations (API returns draft_id, new_version, draft_exists)
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        // This ensures the server component gets fresh data with the new draft
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !cohortData) return false;
    return !cohortData.can_edit;
  }, [isEditMode, cohortData]);

  // Convert departments array to dictionary for efficient lookups (GenericPicker needs Record format)
  const departmentMapping = useMemo(() => {
    const departments = cohortData?.departments || [];
    // Handle both array (new format) and object (legacy format) for backward compatibility
    if (Array.isArray(departments)) {
      return Object.fromEntries(
        departments.map((item) => [item.department_id, item])
      ) as Record<
        string,
        {
          department_id: string;
          name: string;
          description: string;
          simulation_ids: string[];
        }
      >;
    }
    // Legacy format (already a dictionary)
    return departments as Record<
      string,
      {
        department_id: string;
        name: string;
        description: string;
        simulation_ids: string[];
      }
    >;
  }, [cohortData?.departments]);

  // Convert simulations_for_picker array to array format for SelectableGrid
  const simulationsArray = useMemo(() => {
    const simulations = cohortData?.simulations_for_picker || [];
    // Handle both array (new format) and object (legacy format) for backward compatibility
    if (Array.isArray(simulations)) {
      return simulations as Array<{
        simulation_id: string;
        name: string;
        description: string;
        time_limit: number;
        department_ids: string[];
      }>;
    }
    // Legacy format (dictionary) - convert to array
    return Object.values(simulations) as Array<{
      simulation_id: string;
      name: string;
      description: string;
      time_limit: number;
      department_ids: string[];
    }>;
  }, [cohortData?.simulations_for_picker]);

  // Convert to dictionary for efficient lookups (used in contentSections)
  const simulationMapping = useMemo(() => {
    return Object.fromEntries(
      simulationsArray.map((item) => [item.simulation_id, item])
    ) as Record<
      string,
      {
        simulation_id: string;
        name: string;
        description: string;
        time_limit: number;
        department_ids: string[];
      }
    >;
  }, [simulationsArray]);

  const validSimulationIds = useMemo(() => {
    const baseIds = cohortData?.valid_simulation_ids || [];
    const selectedDeptIds =
      (formData["departmentIds"] as string[] | null | undefined) || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of simulation_ids from selected departments
    const deptSimulationIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData?.["simulation_ids"] &&
        Array.isArray(deptData["simulation_ids"])
      ) {
        deptData["simulation_ids"].forEach((id) => deptSimulationIds.add(id));
      }
    });

    // Filter base IDs to only include those in department simulation IDs
    return baseIds.filter((id) => deptSimulationIds.has(id));
  }, [cohortData?.valid_simulation_ids, formData, departmentMapping]);

  // Get current simulation IDs from draftState (not formData, since simulationIds is not in URL)
  const currentSimulationIds = useMemo(() => {
    return draftState.simulationIds || [];
  }, [draftState.simulationIds]);

  // Get can_remove map for simulations
  const simulationCanRemoveMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (cohortData?.simulations) {
      cohortData.simulations.forEach((sim) => {
        if (sim.simulation_id) {
          map[sim.simulation_id] = sim.can_remove ?? false;
        }
      });
    }
    return map;
  }, [cohortData?.simulations]);

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("department_ids" in serverData)
      ) {
        return {};
      }

      const cohortDetail = serverData as CohortDetailOut;
      const deptIds = cohortDetail.department_ids || [];
      const simulationIds = cohortDetail.simulation_ids || [];

      // Initialize simulation active states
      const activeStates: Record<string, boolean> = {};
      if (cohortDetail.simulations) {
        cohortDetail.simulations.forEach((sim) => {
          if (sim.simulation_id) {
            activeStates[sim.simulation_id] = sim.active ?? true;
          }
        });
      }

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (cohortDetail.title) draftUpdates.title = cohortDetail.title;
      if (cohortDetail.description)
        draftUpdates.description = cohortDetail.description;
      if (cohortDetail.active !== undefined)
        draftUpdates.active = cohortDetail.active ?? true;
      if (deptIds.length > 0) draftUpdates["departmentIds"] = deptIds;
      if (simulationIds.length > 0)
        draftUpdates["simulationIds"] = simulationIds;
      if (Object.keys(activeStates).length > 0)
        draftUpdates.simulationActiveStates = activeStates;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    []
  );

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!draftState.title?.trim()) {
        toast.error("Cohort title is required");
        throw new Error("Cohort title is required");
      }

      const validDepartmentIds = cohortData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        draftState.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      // Extract body types for type safety
      type CreateCohortBody = CreateCohortIn extends { body: infer B }
        ? B
        : never;
      type UpdateCohortBody = UpdateCohortIn extends { body: infer B }
        ? B
        : never;

      if (isEditMode) {
        if (!updateCohortAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          const updateRequest: UpdateCohortBody = {
            cohort_id: cohortId!,
            title: draftState.title || "",
            description: draftState.description || "",
            department_ids: finalDepartmentIds || [],
            active: draftState.active ?? true,
            profile_ids: [], // Profile management moved to staff page
            simulation_ids: draftState.simulationIds,
          };
          await updateCohortAction({ body: updateRequest });
          toast.success("Cohort updated successfully!");
          router.push("/create/cohorts");
        } catch (error) {
          toast.error(
            `Failed to update cohort: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createCohortAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          const createRequest: CreateCohortBody = {
            title: draftState.title || "",
            description: draftState.description || "",
            department_ids: finalDepartmentIds || [],
            active: draftState.active || true,
            profile_ids: [], // Profile management moved to staff page
            simulation_ids: draftState.simulationIds,
          };
          await createCohortAction({ body: createRequest });
          toast.success("Cohort created successfully!");
          router.push("/create/cohorts");
        } catch (error) {
          toast.error(
            `Failed to create cohort: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      cohortId,
      isSuperadmin,
      cohortData,
      updateCohortAction,
      createCohortAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasTitle = !!(
        formData["title"] as string | null | undefined
      )?.trim();
      const hasSimulations =
        ((formData["simulationIds"] as string[] | null | undefined) || [])
          .length > 0;

      switch (stepId) {
        case "basic":
          return hasTitle ? "completed" : "active";
        case "simulations":
          if (!hasTitle) return "pending";
          return hasSimulations ? "completed" : "active";
        default:
          return "pending";
      }
    },
    []
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the cohort name, description, departments, and active status.",
        resetFields: [
          "title",
          "description",
          "departmentIds",
          "active",
        ] as string[],
      },
      {
        id: "simulations",
        title: "Simulations",
        description: "Select simulations to include in this cohort.",
        resetFields: [
          "simulationIds",
          "simulationSearch",
          "simulationShowSelected",
        ] as (keyof typeof cohortSearchParamsClient)[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "title",
      "description",
      "active",
      "departmentIds",
      "simulationIds",
      "simulationActiveStates",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "simulations":
        return "Simulations reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/create/cohorts",
      backLabel: "Back",
      createLabel: "Create Cohort",
      updateLabel: "Update Cohort",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
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
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value:
                  (stepFormData["title"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ title: value || null }),
                placeholder: "New Cohort",
                defaultName: "New Cohort",
                required: true,
              }}
              resetFields={
                ["title", "description", "departmentIds", "active"] as string[]
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-cohort-description"
                    value={
                      (stepFormData["description"] as
                        | string
                        | null
                        | undefined) || ""
                    }
                    onChange={(e) =>
                      setStepFormData({
                        description: e.target.value || null,
                      })
                    }
                    placeholder="Enter a brief description (optional)"
                    rows={3}
                    disabled={isReadonly}
                  />
                </div>

                {/* Department Selection */}
                {cohortData?.valid_department_ids &&
                cohortData.valid_department_ids.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departmentMapping}
                      itemIds={cohortData?.valid_department_ids || []}
                      selectedIds={
                        (stepFormData["departmentIds"] as
                          | string[]
                          | null
                          | undefined) || []
                      }
                      onSelect={(ids) =>
                        setStepFormData({
                          departmentIds: ids.length > 0 ? ids : null,
                        })
                      }
                      getId={(dept) => (dept as unknown as { id: string }).id}
                      getLabel={(dept) => String(dept["name"] || "")}
                      getSearchText={(dept) =>
                        `${dept["name"]} ${dept["description"] || ""}`
                      }
                      placeholder="All Departments"
                      disabled={isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
                ) : null}

                {/* Active Switch */}
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="active"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                        Active
                      </Label>
                      <Switch
                        id="active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (cohortData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                        data-testid="switch-cohort-active"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive cohorts will not be shown
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "simulations": {
          const simulationShowSelected =
            (stepFormData["simulationShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const selectedSimulationIds =
            (stepFormData["simulationIds"] as string[] | null | undefined) ||
            [];

          // Filter simulations to only show valid ones
          const filteredSimulations = simulationsArray.filter((sim) =>
            validSimulationIds.includes(sim.simulation_id)
          );

          // Create filter onChange handler (inline function, not useCallback)
          const createSimulationFilterOnChange = (value: boolean) => {
            setStepFormData({ simulationShowSelected: value });
          };

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["simulationSearch"] as
                  | string
                  | null
                  | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ simulationSearch: term || null })
              }
              searchPlaceholder="Search simulations..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: simulationShowSelected,
                  onChange: createSimulationFilterOnChange,
                },
              ]}
              resetFields={[
                "simulationIds",
                "simulationSearch",
                "simulationShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={filteredSimulations}
                selectedId={null}
                selectedIds={selectedSimulationIds}
                onSelect={(simulationId) => {
                  const isSelected =
                    selectedSimulationIds.includes(simulationId);
                  // Prevent unselection if can_remove is false
                  if (
                    isSelected &&
                    simulationCanRemoveMap[simulationId] === false
                  ) {
                    return;
                  }
                  const newIds = isSelected
                    ? selectedSimulationIds.filter((id) => id !== simulationId)
                    : [...selectedSimulationIds, simulationId];
                  setStepFormData({
                    simulationIds: newIds.length > 0 ? newIds : null,
                  });
                }}
                getId={(sim) => sim.simulation_id}
                renderItem={(simulation, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent",
                      isSelected &&
                        simulationCanRemoveMap[simulation.simulation_id] ===
                          false &&
                        "opacity-75 cursor-not-allowed"
                    )}
                  >
                    {/* Check icon - top right */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <PlayCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {simulation.name || "Unnamed Simulation"}
                        </h3>
                        {simulation.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {simulation.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                emptyMessage="No simulations found. Try adjusting your search or filters."
                disabled={isReadonly}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      cohortData,
      departmentMapping,
      simulationsArray,
      validSimulationIds,
      simulationCanRemoveMap,
      isReadonly,
      isEditMode,
    ]
  );

  // Content sections for nested simulation management
  const contentSections = useMemo(() => {
    if (currentSimulationIds.length === 0) {
      return [];
    }

    return [
      {
        id: "active-simulations",
        insertAfter: "simulations",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const activeStates =
            (contentFormData["simulationActiveStates"] as
              | Record<string, boolean>
              | null
              | undefined) || {};
          const simIds =
            (contentFormData["simulationIds"] as string[] | null | undefined) ||
            [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={3}
              stepTitle="Active Simulations"
              stepDescription="Enable or disable simulations in this cohort."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {simIds.map((simulationId) => {
                  const simulation = simulationMapping[simulationId];
                  const simulationData = cohortData?.simulations?.find(
                    (s) => s.simulation_id === simulationId
                  );
                  const active =
                    activeStates[simulationId] ??
                    simulationData?.active ??
                    true;

                  return (
                    <Card key={simulationId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {simulation?.["name"] || "Unnamed Simulation"}
                          </h3>
                          {simulation?.["description"] && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {simulation.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${simulationId}-active`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${simulationId}-active`}
                            checked={active}
                            onCheckedChange={(checked) => {
                              setContentFormData({
                                simulationActiveStates: {
                                  ...activeStates,
                                  [simulationId]: checked,
                                },
                              });
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "simulation-positions",
        insertAfter: "simulations",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const simIds =
            (contentFormData["simulationIds"] as string[] | null | undefined) ||
            [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Simulation Positions"
              stepDescription="Reorder simulations to set their display order."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="space-y-2">
                {simIds.map((simulationId, index) => {
                  const simulation = simulationMapping[simulationId];
                  const canMoveUp = index > 0;
                  const canMoveDown = index < simIds.length - 1;

                  return (
                    <Card key={simulationId} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {simulation?.["name"] || "Unnamed Simulation"}
                          </h3>
                          {simulation?.["description"] && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {simulation.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...simIds];
                              if (index > 0) {
                                const prev = reorderedIds[index - 1];
                                const curr = reorderedIds[index];
                                if (prev !== undefined && curr !== undefined) {
                                  reorderedIds[index - 1] = curr;
                                  reorderedIds[index] = prev;
                                  setContentFormData({
                                    simulationIds: reorderedIds,
                                  });
                                }
                              }
                            }}
                            disabled={!canMoveUp || isReadonly}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...simIds];
                              if (index < simIds.length - 1) {
                                const curr = reorderedIds[index];
                                const next = reorderedIds[index + 1];
                                if (curr !== undefined && next !== undefined) {
                                  reorderedIds[index] = next;
                                  reorderedIds[index + 1] = curr;
                                  setContentFormData({
                                    simulationIds: reorderedIds,
                                  });
                                }
                              }
                            }}
                            disabled={!canMoveDown || isReadonly}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
    ];
  }, [
    currentSimulationIds,
    simulationMapping,
    cohortData?.simulations,
    isReadonly,
    isEditMode,
  ]);

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`cohort-${isEditMode ? "edit" : "new"}`}
      >
        {isReadonly && (
          <div className="bg-muted border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-foreground">
                  Cohort is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {cohortData?.department_ids?.length === 0
                      ? "This is a default cohort that cannot be edited. You can view the details but cannot make changes."
                      : "This cohort cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={
            cohortSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={cohortData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
          contentSections={contentSections}
        />
      </div>
    </TooltipProvider>
  );
}

// Helper function to generate stable ID from server prop
function getStableServerPropId(
  data: CohortDetailOut | CohortNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("cohort_id" in data && data.cohort_id) {
      return `cohort_id:${String(data.cohort_id)}`;
    }
    const keyFields: Record<string, unknown> = {};
    if ("valid_department_ids" in data) {
      keyFields["valid_department_ids"] = Array.isArray(
        data["valid_department_ids"]
      )
        ? data["valid_department_ids"].sort().join(",")
        : data["valid_department_ids"];
    }
    if ("valid_simulation_ids" in data) {
      keyFields["valid_simulation_ids"] = Array.isArray(
        data["valid_simulation_ids"]
      )
        ? data["valid_simulation_ids"].sort().join(",")
        : data["valid_simulation_ids"];
    }
    const sortedKeys = Object.keys(keyFields).sort();
    const hash = sortedKeys
      .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
      .join("|");
    return `new:${hash.length}:${hash.slice(0, 100)}`;
  }
  return String(data);
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(CohortComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.cohortDetail);
  const nextDetailId = getStableServerPropId(nextProps.cohortDetail);
  const prevDefaultId = getStableServerPropId(prevProps.cohortDetailDefault);
  const nextDefaultId = getStableServerPropId(nextProps.cohortDetailDefault);

  // Compare primitive props
  if (prevProps.cohortId !== nextProps.cohortId) {
    return false; // Props changed, re-render
  }

  // Compare server props by content ID, not reference
  if (prevDetailId !== nextDetailId) {
    return false; // Content changed, re-render
  }

  if (prevDefaultId !== nextDefaultId) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
