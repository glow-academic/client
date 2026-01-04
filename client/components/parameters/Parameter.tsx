/**
 * Parameter.tsx
 * Used to create and manage parameters - supports both creation and editing
 * Migrated to GenericForm pattern with nuqs and draft autosave
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
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

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Power,
} from "lucide-react";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Type-only import from server page
import type {
  CreateParameterIn,
  CreateParameterOut,
  ParameterDetailOut,
  ParameterNewOut,
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  UpdateParameterIn,
  UpdateParameterOut,
} from "@/app/(main)/management/parameters/p/[parameterId]/page";

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  parameterDetail?: ParameterDetailOut;
  parameterDetailDefault?: ParameterNewOut;
  // Server actions (replaces useMutation)
  createParameterAction?: (
    input: CreateParameterIn
  ) => Promise<CreateParameterOut>;
  updateParameterAction?: (
    input: UpdateParameterIn
  ) => Promise<UpdateParameterOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchParameterDraftAction?: (
    input: PatchParameterDraftIn
  ) => Promise<PatchParameterDraftOut>;
}

function ParameterComponent({
  parameterId,
  mode = parameterId ? "edit" : "create",
  parameterDetail: serverParameterDetail,
  parameterDetailDefault: serverParameterDetailDefault,
  createParameterAction,
  updateParameterAction,
  patchParameterDraftAction,
}: ParameterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = mode === "edit" && !!parameterId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverParameterDetail | typeof serverParameterDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("parameter_id" in data && data.parameter_id) {
          return `parameter_id:${String(data.parameter_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        if ("valid_field_ids" in data) {
          keyFields["valid_field_ids"] = Array.isArray(
            data["valid_field_ids"]
          )
            ? data["valid_field_ids"].sort().join(",")
            : data["valid_field_ids"];
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

  const parameterDetailId = React.useMemo(
    () => stabilizeServerProp(serverParameterDetail),
    [serverParameterDetail, stabilizeServerProp]
  );
  const parameterDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverParameterDetailDefault),
    [serverParameterDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerParameterDetailRef = React.useRef(serverParameterDetail);
  const latestServerParameterDetailDefaultRef = React.useRef(
    serverParameterDetailDefault
  );

  latestServerParameterDetailRef.current = serverParameterDetail;
  latestServerParameterDetailDefaultRef.current = serverParameterDetailDefault;

  // Use refs to track stable server props
  const stableParameterDetailRef = React.useRef<{
    data: typeof serverParameterDetail;
    id: string | null;
  }>({
    data: serverParameterDetail,
    id: parameterDetailId,
  });
  const stableParameterDetailDefaultRef = React.useRef<{
    data: typeof serverParameterDetailDefault;
    id: string | null;
  }>({
    data: serverParameterDetailDefault,
    id: parameterDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableParameterDetailRef.current.id !== parameterDetailId) {
      stableParameterDetailRef.current = {
        data: latestServerParameterDetailRef.current,
        id: parameterDetailId,
      };
    }
  }, [parameterDetailId]);

  React.useEffect(() => {
    if (
      stableParameterDetailDefaultRef.current.id !== parameterDetailDefaultId
    ) {
      stableParameterDetailDefaultRef.current = {
        data: latestServerParameterDetailDefaultRef.current,
        id: parameterDetailDefaultId,
      };
    }
  }, [parameterDetailDefaultId]);

  // Use stable references
  const parameterDetail = stableParameterDetailRef.current.data;
  const parameterDetailDefault = stableParameterDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const parameterDataId = React.useMemo(() => {
    const data = isEditMode ? parameterDetail : parameterDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("parameter_id" in data && data.parameter_id) {
        return `parameter_id:${String(data.parameter_id)}`;
      }
      const keyFields: Record<string, unknown> = {};
      if ("valid_department_ids" in data) {
        keyFields["valid_department_ids"] = Array.isArray(
          data["valid_department_ids"]
        )
          ? data["valid_department_ids"].sort().join(",")
          : data["valid_department_ids"];
      }
      if ("valid_field_ids" in data) {
        keyFields["valid_field_ids"] = Array.isArray(data["valid_field_ids"])
          ? data["valid_field_ids"].sort().join(",")
          : data["valid_field_ids"];
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, parameterDetail, parameterDetailDefault]);

  const stableParameterDataRef = React.useRef<{
    data: typeof parameterDetail | typeof parameterDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? parameterDetail : parameterDetailDefault,
    id: parameterDataId,
  });

  React.useEffect(() => {
    if (stableParameterDataRef.current.id !== parameterDataId) {
      stableParameterDataRef.current = {
        data: isEditMode ? parameterDetail : parameterDetailDefault,
        id: parameterDataId,
      };
    }
  }, [isEditMode, parameterDetail, parameterDetailDefault, parameterDataId]);

  const parameterData = stableParameterDataRef.current.data;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id ?? null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Inline parsers for URL-backed state (navigation/search params only)
  const parameterSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    fieldSearch: parseAsString,
    // Filter params (URL-backed)
    fieldShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(
    parameterSearchParamsClient,
    {
      history: "replace",
      shallow: true, // Use shallow routing to prevent server component re-renders
    }
  );

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Trigger server component refetch when search/filter params change (for SQL-side filtering)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSearchParamsRef = useRef<{
    search: string | null;
    showSelected: boolean | null;
  }>({
    search: null,
    showSelected: null,
  });

  useEffect(() => {
    const currentSearch = urlParams.fieldSearch || null;
    const currentShowSelected = urlParams.fieldShowSelected ?? null;
    const prevSearch = prevSearchParamsRef.current.search;
    const prevShowSelected = prevSearchParamsRef.current.showSelected;

    // Check if search or filter params actually changed
    const hasChanged =
      prevSearch !== currentSearch || prevShowSelected !== currentShowSelected;

    if (hasChanged) {
      // Update ref for next comparison
      prevSearchParamsRef.current = {
        search: currentSearch,
        showSelected: currentShowSelected,
      };

      // Clear existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // Debounce router.refresh() calls (300ms to match search debounce)
      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 300);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [urlParams.fieldSearch, urlParams.fieldShowSelected, router]);

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    name: string;
    description: string;
    active: boolean;
    simulation_parameter: boolean;
    document_parameter: boolean;
    persona_parameter: boolean;
    scenario_parameter: boolean;
    video_parameter: boolean;
    departmentIds: string[];
    fieldIds: string[]; // Ordered array of field IDs
    fieldActiveStates: Record<string, boolean>; // Active states for fields
    fieldDefaultStates: Record<string, boolean>; // Default states for fields
  };

  // Initialize draft state from server data or draft payload
  // IMPORTANT: Include actual data fields in dependencies, not just IDs, so it recomputes when content changes
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? parameterDetail : parameterDetailDefault;

    if (!data) {
      return {
        name: "",
        description: "",
        active: false,
        simulation_parameter: false,
        document_parameter: false,
        persona_parameter: false,
        scenario_parameter: false,
        video_parameter: false,
        departmentIds: defaultDepartmentIds || [],
        fieldIds: [],
        fieldActiveStates: {},
        fieldDefaultStates: {},
      };
    }

    // Initialize field states from server data or draft payload
    let fieldIds: string[] = [];
    let fieldActiveStates: Record<string, boolean> = {};
    let fieldDefaultStates: Record<string, boolean> = {};

    // Try to read from draft payload fields (returned by SQL when draft exists)
    if (data && "field_ids" in data && data.field_ids) {
      try {
        const parsed =
          typeof data.field_ids === "string"
            ? JSON.parse(data.field_ids)
            : data.field_ids;
        if (Array.isArray(parsed)) {
          fieldIds = parsed.map((id) => String(id));
        }
      } catch (e) {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    if (data && "field_active_states" in data && data.field_active_states) {
      try {
        const parsed =
          typeof data.field_active_states === "string"
            ? JSON.parse(data.field_active_states)
            : data.field_active_states;
        if (parsed && typeof parsed === "object") {
          fieldActiveStates = parsed as Record<string, boolean>;
        }
      } catch (e) {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    if (data && "field_default_states" in data && data.field_default_states) {
      try {
        const parsed =
          typeof data.field_default_states === "string"
            ? JSON.parse(data.field_default_states)
            : data.field_default_states;
        if (parsed && typeof parsed === "object") {
          fieldDefaultStates = parsed as Record<string, boolean>;
        }
      } catch (e) {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    // If draft payload didn't have these fields, fall back to extracting from array data (edit mode only)
    if (
      fieldIds.length === 0 &&
      isEditMode &&
      parameterDetail &&
      "field_connections" in parameterDetail &&
      parameterDetail.field_connections
    ) {
      // Extract from field_connections array
      parameterDetail.field_connections.forEach((conn) => {
        const fieldId = conn.field_id;
        if (fieldId) {
          fieldIds.push(fieldId);
          fieldActiveStates[fieldId] = conn.active ?? true;
          fieldDefaultStates[fieldId] = conn.default ?? false;
        }
      });
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      name: data.name || "",
      description: data.description || "",
      active: data.active ?? false,
      simulation_parameter: data.simulation_parameter ?? false,
      document_parameter: data.document_parameter ?? false,
      persona_parameter: data.persona_parameter ?? false,
      scenario_parameter: data.scenario_parameter ?? false,
      video_parameter: data.video_parameter ?? false,
      departmentIds: data.department_ids || defaultDepartmentIds || [],
      fieldIds,
      fieldActiveStates,
      fieldDefaultStates,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    parameterDetail,
    parameterDetailDefault,
    parameterDetailId,
    parameterDetailDefaultId,
    draftId,
    urlDraftId,
    defaultDepartmentIds,
    // Include actual content fields so it recomputes when server data changes
    parameterDetailDefault?.name,
    parameterDetailDefault?.description,
    parameterDetailDefault?.active,
    parameterDetailDefault?.simulation_parameter,
    parameterDetailDefault?.document_parameter,
    parameterDetailDefault?.persona_parameter,
    parameterDetailDefault?.scenario_parameter,
    parameterDetailDefault?.video_parameter,
    parameterDetailDefault?.department_ids,
    parameterDetailDefault?.field_ids,
    parameterDetailDefault?.field_active_states,
    parameterDetailDefault?.field_default_states,
    parameterDetail?.name,
    parameterDetail?.description,
    parameterDetail?.active,
    parameterDetail?.simulation_parameter,
    parameterDetail?.document_parameter,
    parameterDetail?.persona_parameter,
    parameterDetail?.scenario_parameter,
    parameterDetail?.video_parameter,
    parameterDetail?.department_ids,
    parameterDetail?.field_connections,
    parameterDetail?.field_ids,
    parameterDetail?.field_active_states,
    parameterDetail?.field_default_states,
  ]);

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
      fieldSearch: urlParams.fieldSearch || null,
      fieldShowSelected: urlParams.fieldShowSelected ?? false,
    } as Record<string, unknown>;
  }, [
    draftState,
    urlParams.fieldSearch,
    urlParams.fieldShowSelected,
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
          key === "name" ||
          key === "description" ||
          key === "active" ||
          key === "simulation_parameter" ||
          key === "document_parameter" ||
          key === "persona_parameter" ||
          key === "scenario_parameter" ||
          key === "video_parameter" ||
          key === "departmentIds" ||
          key === "fieldIds" ||
          key === "fieldActiveStates" ||
          key === "fieldDefaultStates"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (key === "fieldSearch") {
          // Update URL params for search/filter operations
          urlUpdates["fieldSearch"] =
            (value as string) && (value as string).length > 0
              ? (value as string)
              : null;
        } else if (key === "fieldShowSelected") {
          // Update URL params for filter operations
          urlUpdates["fieldShowSelected"] = value === true ? true : null;
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

  // Set breadcrumb context when parameter data is loaded
  useEffect(() => {
    if (parameterDetail?.name && parameterId && isEditMode) {
      setEntityMetadata({
        entityId: parameterId,
        entityName: parameterDetail.name,
        entityType: "parameter",
      });
    }
    return () => clearEntityMetadata();
  }, [
    parameterDetail,
    parameterId,
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
    patchDraftAction: patchParameterDraftAction
      ? async (input) => {
          // Transform camelCase keys to snake_case for draft payload (SQL expects snake_case)
          const camelToSnake: Record<string, string> = {
            departmentIds: "department_ids",
            fieldIds: "field_ids",
            fieldActiveStates: "field_active_states",
            fieldDefaultStates: "field_default_states",
          };
          const transformedPatch: Record<string, unknown> = {};
          Object.entries(input.body.patch as Record<string, unknown>).forEach(
            ([key, value]) => {
              const snakeKey = camelToSnake[key] || key;
              transformedPatch[snakeKey] = value;
            }
          );

          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchParameterDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: transformedPatch,
              expected_version: input.body.expected_version,
            } as PatchParameterDraftIn["body"],
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
    if (!isEditMode || !parameterData) return false;
    return !parameterData.can_edit;
  }, [isEditMode, parameterData]);

  // Convert departments array to dictionary for efficient lookups (GenericPicker needs Record format)
  const departmentMapping = useMemo(() => {
    const departments = parameterData?.departments || [];
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
      }
    >;
  }, [parameterData?.departments]);

  // Convert fields array to array format for SelectableGrid
  const fieldsArray = useMemo(() => {
    const fields = parameterData?.fields || [];
    // Handle both array (new format) and object (legacy format) for backward compatibility
    if (Array.isArray(fields)) {
      return fields as Array<{
        field_id: string;
        name: string;
        description: string;
        usage_count: number;
        department_ids: string[];
      }>;
    }
    // Legacy format (dictionary) - convert to array
    return Object.values(fields) as Array<{
      field_id: string;
      name: string;
      description: string;
      usage_count: number;
      department_ids: string[];
    }>;
  }, [parameterData?.fields]);

  // Convert to dictionary for efficient lookups (used in contentSections)
  const fieldMapping = useMemo(() => {
    return Object.fromEntries(
      fieldsArray.map((item) => [item.field_id, item])
    ) as Record<
      string,
      {
        field_id: string;
        name: string;
        description: string;
        usage_count: number;
        department_ids: string[];
      }
    >;
  }, [fieldsArray]);

  const validFieldIds = useMemo(() => {
    return parameterData?.valid_field_ids || [];
  }, [parameterData?.valid_field_ids]);


  // Get current field IDs from draftState (not formData, since fieldIds is not in URL)
  const currentFieldIds = useMemo(() => {
    return draftState.fieldIds || [];
  }, [draftState.fieldIds]);

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

      const parameterDetail = serverData as ParameterDetailOut;
      const deptIds = parameterDetail.department_ids || [];
      const fieldIds: string[] = [];
      const fieldActiveStates: Record<string, boolean> = {};
      const fieldDefaultStates: Record<string, boolean> = {};

      if (parameterDetail.field_connections) {
        parameterDetail.field_connections.forEach((conn) => {
          const fieldId = conn.field_id;
          if (fieldId) {
            fieldIds.push(fieldId);
            fieldActiveStates[fieldId] = conn.active ?? true;
            fieldDefaultStates[fieldId] = conn.default ?? false;
          }
        });
      }

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (parameterDetail.name) draftUpdates.name = parameterDetail.name;
      if (parameterDetail.description)
        draftUpdates.description = parameterDetail.description;
      if (parameterDetail.active !== undefined)
        draftUpdates.active = parameterDetail.active ?? false;
      if (parameterDetail.simulation_parameter !== undefined)
        draftUpdates.simulation_parameter =
          parameterDetail.simulation_parameter ?? false;
      if (parameterDetail.document_parameter !== undefined)
        draftUpdates.document_parameter =
          parameterDetail.document_parameter ?? false;
      if (parameterDetail.persona_parameter !== undefined)
        draftUpdates.persona_parameter =
          parameterDetail.persona_parameter ?? false;
      if (parameterDetail.scenario_parameter !== undefined)
        draftUpdates.scenario_parameter =
          parameterDetail.scenario_parameter ?? false;
      if (parameterDetail.video_parameter !== undefined)
        draftUpdates.video_parameter = parameterDetail.video_parameter ?? false;
      if (deptIds.length > 0) draftUpdates.departmentIds = deptIds;
      if (fieldIds.length > 0) draftUpdates.fieldIds = fieldIds;
      if (Object.keys(fieldActiveStates).length > 0)
        draftUpdates.fieldActiveStates = fieldActiveStates;
      if (Object.keys(fieldDefaultStates).length > 0)
        draftUpdates.fieldDefaultStates = fieldDefaultStates;

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
      if (!draftState.name?.trim()) {
        toast.error("Parameter name is required");
        throw new Error("Parameter name is required");
      }

      const validDepartmentIds = parameterData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        draftState.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      // Prepare field connections for submission
      const orderedFieldIds = draftState.fieldIds || [];
      const fieldActiveStates = draftState.fieldActiveStates || {};
      const fieldDefaultStates = draftState.fieldDefaultStates || {};

      const connectionEntries = orderedFieldIds
        .map((fieldId) => {
          const active = fieldActiveStates[fieldId] ?? true;
          const defaultState = fieldDefaultStates[fieldId] ?? false;
          return {
            field_id: fieldId,
            default: defaultState,
            active,
          };
        })
        .filter((conn) => conn); // Only include fields with connections

      const defaultCount = connectionEntries.filter((conn) => conn.default)
        .length;

      // Ensure exactly one default
      let fieldConnectionsToSubmit = connectionEntries.map((conn, index) => {
        return {
          ...conn,
          default: defaultCount === 0 ? index === 0 : conn.default,
        };
      });

      if (defaultCount === 0 && fieldConnectionsToSubmit.length > 0) {
        fieldConnectionsToSubmit[0]!.default = true;
      } else if (defaultCount > 1) {
        // Keep only the first default
        let foundFirst = false;
        fieldConnectionsToSubmit = fieldConnectionsToSubmit.map((conn) => {
          if (conn.default && !foundFirst) {
            foundFirst = true;
            return { ...conn, default: true };
          }
          return { ...conn, default: false };
        });
      }

      // Extract body types for type safety
      type CreateParameterBody = CreateParameterIn extends { body: infer B }
        ? B
        : never;
      type UpdateParameterBody = UpdateParameterIn extends { body: infer B }
        ? B
        : never;

      if (isEditMode) {
        if (!updateParameterAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          const updateRequest: UpdateParameterBody = {
            parameter_id: parameterId!,
            name: draftState.name || "",
            description: draftState.description || "",
            active: draftState.active ?? false,
            simulation_parameter: draftState.simulation_parameter ?? false,
            document_parameter: draftState.document_parameter ?? false,
            persona_parameter: draftState.persona_parameter ?? false,
            scenario_parameter: draftState.scenario_parameter ?? false,
            video_parameter: draftState.video_parameter ?? false,
            department_ids: finalDepartmentIds || [],
            field_connections: fieldConnectionsToSubmit,
          };
          await updateParameterAction({ body: updateRequest });
          toast.success("Parameter updated successfully!");
          router.push("/management/parameters");
        } catch (error) {
          toast.error(
            `Failed to update parameter: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createParameterAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          const createRequest: CreateParameterBody = {
            name: draftState.name || "",
            description: draftState.description || "",
            active: draftState.active ?? false,
            simulation_parameter: draftState.simulation_parameter ?? false,
            document_parameter: draftState.document_parameter ?? false,
            persona_parameter: draftState.persona_parameter ?? false,
            scenario_parameter: draftState.scenario_parameter ?? false,
            video_parameter: draftState.video_parameter ?? false,
            department_ids: finalDepartmentIds || [],
            field_connections: fieldConnectionsToSubmit,
          };
          await createParameterAction({ body: createRequest });
          toast.success("Parameter created successfully!");
          router.push("/management/parameters");
        } catch (error) {
          toast.error(
            `Failed to create parameter: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      parameterId,
      isSuperadmin,
      parameterData,
      effectiveProfile?.id,
      updateParameterAction,
      createParameterAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();
      const hasFields =
        ((formData["fieldIds"] as string[] | null | undefined) || []).length >
        0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "parameter-config":
          if (!hasName) return "pending";
          return "completed"; // Always completed once basic info is done
        case "fields":
          if (!hasName) return "pending";
          return hasFields ? "completed" : "active";
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
          "Set the parameter name, description, departments, and active status.",
        resetFields: [
          "name",
          "description",
          "departmentIds",
          "active",
        ] as string[],
      },
      {
        id: "parameter-config",
        title: "Parameter Configuration",
        description:
          "Configure which parameter types this parameter applies to.",
        resetFields: [
          "simulation_parameter",
          "document_parameter",
          "persona_parameter",
          "scenario_parameter",
          "video_parameter",
        ] as string[],
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields to include in this parameter.",
        resetFields: [
          "fieldIds",
          "fieldSearch",
          "fieldShowSelected",
        ] as (keyof typeof parameterSearchParamsClient)[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "simulation_parameter",
      "document_parameter",
      "persona_parameter",
      "scenario_parameter",
      "video_parameter",
      "departmentIds",
      "fieldIds",
      "fieldActiveStates",
      "fieldDefaultStates",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameter-config":
        return "Parameter configuration reset";
      case "fields":
        return "Fields reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/management/parameters",
      backLabel: "Back",
      createLabel: "Create Parameter",
      updateLabel: "Update Parameter",
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
                  (stepFormData["name"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "e.g., Student Age",
                defaultName: "New Parameter",
                required: true,
              }}
              resetFields={["name", "description", "departmentIds", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-parameter-description"
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
                {parameterData?.valid_department_ids &&
                parameterData.valid_department_ids.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departmentMapping}
                      itemIds={parameterData?.valid_department_ids || []}
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
                          (parameterData as { active?: boolean })?.active ??
                          false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive parameters will not be available for selection
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "parameter-config":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "simulation_parameter",
                "document_parameter",
                "persona_parameter",
                "scenario_parameter",
                "video_parameter",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Simulation Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="simulation_parameter">
                        Simulation Parameter
                      </Label>
                      <Switch
                        id="simulation_parameter"
                        checked={
                          (stepFormData["simulation_parameter"] as
                            | boolean
                            | null
                            | undefined) ?? false
                        }
                        onCheckedChange={(checked) => {
                          setStepFormData({
                            simulation_parameter: checked,
                            // Reset child switches when toggling simulation_parameter
                            document_parameter: checked
                              ? false
                              : (stepFormData["document_parameter"] as
                                  | boolean
                                  | null
                                  | undefined) ?? false,
                            persona_parameter: checked
                              ? false
                              : (stepFormData["persona_parameter"] as
                                  | boolean
                                  | null
                                  | undefined) ?? false,
                            scenario_parameter: checked
                              ? false
                              : (stepFormData["scenario_parameter"] as
                                  | boolean
                                  | null
                                  | undefined) ?? false,
                            video_parameter: checked
                              ? false
                              : (stepFormData["video_parameter"] as
                                  | boolean
                                  | null
                                  | undefined) ?? false,
                          });
                        }}
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for simulations
                    </p>
                  </div>

                  {/* Document Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="document_parameter">
                        Document Parameter
                      </Label>
                      <Switch
                        id="document_parameter"
                        checked={
                          (stepFormData["document_parameter"] as
                            | boolean
                            | null
                            | undefined) ?? false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ document_parameter: checked })
                        }
                        disabled={
                          isReadonly ||
                          (stepFormData["simulation_parameter"] as
                            | boolean
                            | null
                            | undefined) === true
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for documents
                    </p>
                  </div>

                  {/* Persona Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="persona_parameter">
                        Persona Parameter
                      </Label>
                      <Switch
                        id="persona_parameter"
                        checked={
                          (stepFormData["persona_parameter"] as
                            | boolean
                            | null
                            | undefined) ?? false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ persona_parameter: checked })
                        }
                        disabled={
                          isReadonly ||
                          (stepFormData["simulation_parameter"] as
                            | boolean
                            | null
                            | undefined) === true
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for personas
                    </p>
                  </div>

                  {/* Scenario Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="scenario_parameter">
                        Scenario Parameter
                      </Label>
                      <Switch
                        id="scenario_parameter"
                        checked={
                          (stepFormData["scenario_parameter"] as
                            | boolean
                            | null
                            | undefined) ?? false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ scenario_parameter: checked })
                        }
                        disabled={
                          isReadonly ||
                          (stepFormData["simulation_parameter"] as
                            | boolean
                            | null
                            | undefined) === true
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for scenarios
                    </p>
                  </div>

                  {/* Video Parameter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="video_parameter">Video Parameter</Label>
                      <Switch
                        id="video_parameter"
                        checked={
                          (stepFormData["video_parameter"] as
                            | boolean
                            | null
                            | undefined) ?? false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ video_parameter: checked })
                        }
                        disabled={
                          isReadonly ||
                          (stepFormData["simulation_parameter"] as
                            | boolean
                            | null
                            | undefined) === true
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable this parameter for videos
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "fields": {
          const fieldShowSelected =
            (stepFormData["fieldShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const selectedFieldIds =
            (stepFormData["fieldIds"] as string[] | null | undefined) || [];
          const fieldSearch =
            (stepFormData["fieldSearch"] as string | null | undefined) || "";

          // Filter fields: department-based + client-side search/show_selected for immediate UI feedback
          let filteredFields = fieldsArray.filter((field) =>
            validFieldIds.includes(field.field_id)
          );

          // Apply client-side search filter (for immediate UI feedback while server request is in flight)
          if (fieldSearch.trim()) {
            const searchLower = fieldSearch.toLowerCase();
            filteredFields = filteredFields.filter(
              (field) =>
                field.name.toLowerCase().includes(searchLower) ||
                (field.description || "").toLowerCase().includes(searchLower)
            );
          }

          // Apply client-side "show selected" filter (for immediate UI feedback)
          if (fieldShowSelected && selectedFieldIds.length > 0) {
            filteredFields = filteredFields.filter((field) =>
              selectedFieldIds.includes(field.field_id)
            );
          }

          // Create filter onChange handler (inline function, not useCallback)
          const createFieldFilterOnChange = (value: boolean) => {
            setStepFormData({ fieldShowSelected: value });
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
                (stepFormData["fieldSearch"] as
                  | string
                  | null
                  | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ fieldSearch: term || null })
              }
              searchPlaceholder="Search fields..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: fieldShowSelected,
                  onChange: createFieldFilterOnChange,
                },
              ]}
              resetFields={["fieldIds", "fieldSearch", "fieldShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={filteredFields}
                selectedId={null}
                selectedIds={selectedFieldIds}
                onSelect={(fieldId) => {
                  const isSelected = selectedFieldIds.includes(fieldId);
                  const newIds = isSelected
                    ? selectedFieldIds.filter((id) => id !== fieldId)
                    : [...selectedFieldIds, fieldId];
                  setStepFormData({
                    fieldIds: newIds.length > 0 ? newIds : null,
                    // Initialize active/default states for new fields
                    fieldActiveStates: {
                      ...((stepFormData["fieldActiveStates"] as
                        | Record<string, boolean>
                        | null
                        | undefined) || {}),
                      [fieldId]: !isSelected ? true : undefined,
                    },
                    fieldDefaultStates: {
                      ...((stepFormData["fieldDefaultStates"] as
                        | Record<string, boolean>
                        | null
                        | undefined) || {}),
                      [fieldId]: !isSelected ? false : undefined,
                    },
                  });
                }}
                getId={(field) => field.field_id}
                renderItem={(field, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {/* Check icon - top right */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {field.name || "Unnamed Field"}
                        </h3>
                        {field.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {field.description}
                          </p>
                        )}
                        {field.usage_count !== undefined &&
                          field.usage_count > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Used in {field.usage_count} scenario
                              {field.usage_count !== 1 ? "s" : ""}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                )}
                emptyMessage="No fields found. Try adjusting your search or filters."
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
      parameterData,
      departmentMapping,
      fieldsArray,
      validFieldIds,
      isReadonly,
      isEditMode,
    ]
  );

  // Content sections for nested field management
  const contentSections = useMemo(() => {
    const fieldIds = draftState.fieldIds || [];
    if (fieldIds.length === 0) {
      return [];
    }

    return [
      {
        id: "active-fields",
        insertAfter: "fields",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const activeStates =
            (contentFormData["fieldActiveStates"] as
              | Record<string, boolean>
              | null
              | undefined) || {};
          const fieldIdsFromState =
            (contentFormData["fieldIds"] as string[] | null | undefined) || [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={3}
              stepTitle="Active Fields"
              stepDescription="Enable or disable fields in this parameter."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fieldIdsFromState.map((fieldId) => {
                  const field = fieldMapping[fieldId];
                  const active = activeStates[fieldId] ?? true;

                  return (
                    <Card key={fieldId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {field?.["name"] || "Unnamed Field"}
                          </h3>
                          {field?.["description"] && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {field.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${fieldId}-active`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${fieldId}-active`}
                            checked={active}
                            onCheckedChange={(checked) => {
                              const newActiveStates = {
                                ...activeStates,
                                [fieldId]: checked,
                              };
                              setContentFormData({
                                fieldActiveStates: newActiveStates,
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
        id: "field-positions",
        insertAfter: "fields",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const fieldIdsFromState =
            (contentFormData["fieldIds"] as string[] | null | undefined) || [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Field Positions"
              stepDescription="Reorder fields to set their display order."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="space-y-2">
                {fieldIdsFromState.map((fieldId, index) => {
                  const field = fieldMapping[fieldId];
                  const canMoveUp = index > 0;
                  const canMoveDown = index < fieldIdsFromState.length - 1;

                  return (
                    <Card key={fieldId} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {field?.["name"] || "Unnamed Field"}
                          </h3>
                          {field?.["description"] && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {field.description}
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
                              const reorderedIds = [...fieldIdsFromState];
                              if (index > 0) {
                                const prev = reorderedIds[index - 1];
                                const curr = reorderedIds[index];
                                if (prev !== undefined && curr !== undefined) {
                                  reorderedIds[index - 1] = curr;
                                  reorderedIds[index] = prev;
                                  setContentFormData({
                                    fieldIds: reorderedIds,
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
                              const reorderedIds = [...fieldIdsFromState];
                              if (index < fieldIdsFromState.length - 1) {
                                const curr = reorderedIds[index];
                                const next = reorderedIds[index + 1];
                                if (curr !== undefined && next !== undefined) {
                                  reorderedIds[index] = next;
                                  reorderedIds[index + 1] = curr;
                                  setContentFormData({
                                    fieldIds: reorderedIds,
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
      {
        id: "default-fields",
        insertAfter: "fields",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const defaultStates =
            (contentFormData["fieldDefaultStates"] as
              | Record<string, boolean>
              | null
              | undefined) || {};
          const fieldIdsFromState =
            (contentFormData["fieldIds"] as string[] | null | undefined) || [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={5}
              stepTitle="Default Field"
              stepDescription="Select which field should be the default (only one can be default)."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fieldIdsFromState.map((fieldId) => {
                  const field = fieldMapping[fieldId];
                  const isDefault = defaultStates[fieldId] ?? false;

                  return (
                    <Card key={fieldId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {field?.["name"] || "Unnamed Field"}
                          </h3>
                          {field?.["description"] && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {field.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${fieldId}-default`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            Default
                          </Label>
                          <Switch
                            id={`${fieldId}-default`}
                            checked={isDefault}
                            onCheckedChange={(checked) => {
                              const newDefaultStates: Record<string, boolean> =
                                {};
                              // Unset all other defaults
                              fieldIdsFromState.forEach((id) => {
                                newDefaultStates[id] = id === fieldId && checked;
                              });
                              setContentFormData({
                                fieldDefaultStates: newDefaultStates,
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
    ];
  }, [currentFieldIds, fieldMapping, isReadonly, isEditMode]);

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`parameter-${isEditMode ? "edit" : "new"}`}
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
                  Parameter is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {parameterData?.department_ids?.length === 0
                      ? "This is a default parameter that cannot be edited. You can view the details but cannot make changes."
                      : "This parameter cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={
            parameterSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={parameterData}
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
  data: ParameterDetailOut | ParameterNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("parameter_id" in data && data.parameter_id) {
      return `parameter_id:${String(data.parameter_id)}`;
    }
    const keyFields: Record<string, unknown> = {};
    if ("valid_department_ids" in data) {
      keyFields["valid_department_ids"] = Array.isArray(
        data["valid_department_ids"]
      )
        ? data["valid_department_ids"].sort().join(",")
        : data["valid_department_ids"];
    }
    if ("valid_field_ids" in data) {
      keyFields["valid_field_ids"] = Array.isArray(data["valid_field_ids"])
        ? data["valid_field_ids"].sort().join(",")
        : data["valid_field_ids"];
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
export default React.memo(ParameterComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.parameterDetail);
  const nextDetailId = getStableServerPropId(nextProps.parameterDetail);
  const prevDefaultId = getStableServerPropId(
    prevProps.parameterDetailDefault
  );
  const nextDefaultId = getStableServerPropId(
    nextProps.parameterDetailDefault
  );

  // Compare primitive props
  if (
    prevProps.parameterId !== nextProps.parameterId ||
    prevProps.mode !== nextProps.mode
  ) {
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
