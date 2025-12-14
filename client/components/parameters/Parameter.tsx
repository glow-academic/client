/**
 * Parameter.tsx
 * Used to create and manage parameters - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ParameterBasicInfoSection } from "@/components/parameters/ParameterBasicInfoSection";
import { ParameterConfigurationSection } from "@/components/parameters/ParameterConfigurationSection";
import { ParameterFieldCardGrid } from "@/components/common/parameters/ParameterFieldCardGrid";
import { ParameterFieldSection } from "@/components/common/parameters/ParameterFieldSection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Check, Loader2 } from "lucide-react";

// Type-only import from server page
import type {
  CreateParameterIn,
  CreateParameterOut,
  ParameterDetailOut,
  ParameterNewOut,
  UpdateParameterIn,
  UpdateParameterOut,
} from "@/app/(main)/management/parameters/p/[parameterId]/page";

type MappingItem = {
  name: string;
  description: string;
  entity_id: string;
  entity_type: string;
};

interface FormData {
  name?: string;
  description?: string;
  active?: boolean;
  simulation_parameter?: boolean;
  document_parameter?: boolean;
  persona_parameter?: boolean;
  scenario_parameter?: boolean;
  video_parameter?: boolean;
  departmentIds?: string[] | null;
}

interface FieldConnectionState {
  default: boolean;
  active: boolean;
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  // Optional server-provided data and actions (for server-side rendering)
  parameterDetail?: ParameterDetailOut;
  parameterDetailDefault?: ParameterNewOut;
  createParameterAction?: (
    input: CreateParameterIn
  ) => Promise<CreateParameterOut>;
  updateParameterAction?: (
    input: UpdateParameterIn
  ) => Promise<UpdateParameterOut>;
}

export default function Parameter({
  parameterId,
  mode = parameterId ? "edit" : "create",
  parameterDetail: serverParameterDetail,
  parameterDetailDefault: serverParameterDetailDefault,
  createParameterAction,
  updateParameterAction,
}: ParameterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isEditMode = mode === "edit" && !!parameterId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  // Helper function to update URL with query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Use comma-separated values to match how page.tsx reads them
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      const newParamsString = params.toString();
      router.replace(`${pathname}?${newParamsString}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      active: false,
      simulation_parameter: false,
      document_parameter: false,
      persona_parameter: false,
      scenario_parameter: false,
      video_parameter: false,
      departmentIds:
        defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
    }),
    [defaultDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  // Field connections state: field_id -> { default, active }
  const [fieldConnections, setFieldConnections] = useState<
    Record<string, FieldConnectionState>
  >({});
  const [originalFieldConnections, setOriginalFieldConnections] = useState<
    Record<string, FieldConnectionState>
  >({});

  // State for field IDs (using URL params as source of truth)
  const [currentFieldIds, setCurrentFieldIds] = useState<string[]>([]);

  // State for accordion (only one section open at a time)
  const [openAccordionItem, setOpenAccordionItem] = useState<string | null>(
    null
  );

  // Track if we've initialized URL params from server data to prevent infinite loops
  const hasInitializedUrlParamsRef = useRef(false);

  // Use server-provided data (no React Query needed when server data is provided)
  const parameterDetail = serverParameterDetail;
  const parameterDetailDefault = serverParameterDetailDefault;
  const parameterData = isEditMode ? parameterDetail : parameterDetailDefault;

  // Extract body types from server action types for type safety
  type CreateParameterBody = CreateParameterIn extends { body: infer B }
    ? B
    : never;
  type UpdateParameterBody = UpdateParameterIn extends { body: infer B }
    ? B
    : never;

  // Use server actions directly (no mutations needed)
  const handleCreateParameter = async (body: CreateParameterBody) => {
    if (!createParameterAction) {
      throw new Error("createParameterAction is required");
    }
    await createParameterAction({ body });
  };

  const handleUpdateParameter = async (body: UpdateParameterBody) => {
    if (!updateParameterAction) {
      throw new Error("updateParameterAction is required");
    }
    await updateParameterAction({ body });
  };

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

  // Extract mappings from v3 response
  const departmentMapping = useMemo(
    () =>
      (parameterData?.department_mapping || {}) as Record<string, MappingItem>,
    [parameterData]
  );

  const validDepartmentIds = useMemo(
    () => parameterData?.valid_department_ids || [],
    [parameterData]
  );

  const fieldMapping = useMemo(
    () =>
      (parameterData?.field_mapping || {}) as Record<
        string,
        {
          name: string;
          description?: string;
          usage_count?: number;
          department_ids?: string[] | null;
        }
      >,
    [parameterData]
  );

  const validFieldIds = useMemo(
    () => parameterData?.valid_field_ids || [],
    [parameterData]
  );

  // Initialize form data from v3 response
  useEffect(() => {
    if (isEditMode && parameterData) {
      const formDataFromServer = {
        name: parameterData.name,
        description: parameterData.description,
        active: parameterData.active,
        simulation_parameter: parameterData.simulation_parameter ?? false,
        document_parameter: parameterData.document_parameter ?? false,
        persona_parameter: parameterData.persona_parameter ?? false,
        scenario_parameter: parameterData.scenario_parameter ?? false,
        video_parameter: parameterData.video_parameter ?? false,
        departmentIds: parameterData.department_ids || null,
      };
      setFormData(formDataFromServer);
      setOriginalFormData(formDataFromServer);
    } else if (!isEditMode && parameterData) {
      // For create mode, use data from default detail endpoint
      setFormData({
        ...initialFormData,
        departmentIds:
          defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
      });
      setOriginalFormData({
        ...initialFormData,
        departmentIds:
          defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
      });
    }
  }, [parameterData, isEditMode, initialFormData, defaultDepartmentIds]);

  // Initialize field connections and field IDs from server data
  useEffect(() => {
    if (isEditMode && parameterData?.field_connections) {
      const connections: Record<string, FieldConnectionState> = {};
      const originalConnections: Record<string, FieldConnectionState> = {};
      const fieldIds: string[] = [];

      parameterData.field_connections.forEach((conn) => {
        connections[conn.field_id] = {
          default: conn.default,
          active: conn.active,
        };
        originalConnections[conn.field_id] = {
          default: conn.default,
          active: conn.active,
        };
        fieldIds.push(conn.field_id);
      });

      setFieldConnections(connections);
      setOriginalFieldConnections(originalConnections);

      // Prioritize URL params if they exist, otherwise use server data
      const fieldIdsFromUrl =
        searchParams.get("fieldIds")?.split(",").filter(Boolean) || [];
      const orderedFieldIds =
        fieldIdsFromUrl.length > 0 ? fieldIdsFromUrl : fieldIds;

      setCurrentFieldIds((prev) => {
        // Compare arrays preserving order (not sorted)
        const hasChanged =
          prev.length !== orderedFieldIds.length ||
          prev.some((id, idx) => id !== orderedFieldIds[idx]);
        return hasChanged ? orderedFieldIds : prev;
      });

      // Update URL params if we're using server data and URL is empty (only in edit mode)
      // Only do this once to prevent infinite loops
      if (
        isEditMode &&
        !hasInitializedUrlParamsRef.current &&
        fieldIdsFromUrl.length === 0 &&
        orderedFieldIds.length > 0
      ) {
        hasInitializedUrlParamsRef.current = true;
        updateUrlParams({
          fieldIds: orderedFieldIds,
        });
      }
    } else if (!isEditMode) {
      // Reset for create mode
      setFieldConnections({});
      setOriginalFieldConnections({});
      setCurrentFieldIds([]);
    }
  }, [
    isEditMode,
    parameterData?.field_connections,
    searchParams,
    updateUrlParams,
  ]);

  // Sync field IDs from URL params (DHH-style: compute when needed, not in effects)
  useEffect(() => {
    const fieldIdsFromUrl =
      searchParams.get("fieldIds")?.split(",").filter(Boolean) || [];

    // Compare arrays preserving order (not sorted)
    const arraysEqual =
      fieldIdsFromUrl.length === currentFieldIds.length &&
      fieldIdsFromUrl.every((id, idx) => id === currentFieldIds[idx]);

    if (!arraysEqual) {
      setCurrentFieldIds(fieldIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes

  // Handlers for field connections
  const handleFieldSelect = useCallback(
    (fieldIds: string[]) => {
      setCurrentFieldIds(fieldIds);
      // Update URL params when fields are selected
      updateUrlParams({
        fieldIds: fieldIds.length > 0 ? fieldIds : null,
      });

      setFieldConnections((prev) => {
        const updated = { ...prev };
        // Add new connections with default active=true, default=false
        fieldIds.forEach((fieldId) => {
          if (!updated[fieldId]) {
            updated[fieldId] = { default: false, active: true };
          }
        });
        // Remove connections that are no longer selected
        Object.keys(updated).forEach((fieldId) => {
          if (!fieldIds.includes(fieldId)) {
            delete updated[fieldId];
          }
        });
        return updated;
      });
    },
    [updateUrlParams]
  );

  const handleDefaultToggle = useCallback(
    (fieldId: string, isDefault: boolean) => {
      setFieldConnections((prev) => {
        const updated = { ...prev };
        if (isDefault) {
          // Unset all other defaults
          Object.keys(updated).forEach((id) => {
            if (id !== fieldId) {
              updated[id] = { ...updated[id]!, default: false };
            }
          });
        }
        updated[fieldId] = { ...updated[fieldId]!, default: isDefault };
        return updated;
      });
    },
    []
  );

  const handleActiveToggle = useCallback(
    (fieldId: string, isActive: boolean) => {
      setFieldConnections((prev) => {
        const updated = { ...prev };
        updated[fieldId] = { ...updated[fieldId]!, active: isActive };
        return updated;
      });
    },
    []
  );

  // Position handlers for fields
  const handleFieldMoveUp = useCallback(
    (fieldId: string) => {
      // Get ordered field IDs from searchParams (source of truth)
      const orderedIds =
        searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
        [...currentFieldIds];

      const index = orderedIds.indexOf(fieldId);
      if (index <= 0) return;

      // Swap with previous item
      const reorderedIds = [...orderedIds];
      [reorderedIds[index - 1], reorderedIds[index]] = [
        reorderedIds[index],
        reorderedIds[index - 1],
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentFieldIds(reorderedIds);
      updateUrlParams({
        fieldIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentFieldIds, searchParams, updateUrlParams]
  );

  const handleFieldMoveDown = useCallback(
    (fieldId: string) => {
      // Get ordered field IDs from searchParams (source of truth)
      const orderedIds =
        searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
        [...currentFieldIds];

      const index = orderedIds.indexOf(fieldId);
      if (index < 0 || index >= orderedIds.length - 1) return;

      // Swap with next item
      const reorderedIds = [...orderedIds];
      [reorderedIds[index], reorderedIds[index + 1]] = [
        reorderedIds[index + 1],
        reorderedIds[index],
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentFieldIds(reorderedIds);
      updateUrlParams({
        fieldIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentFieldIds, searchParams, updateUrlParams]
  );

  // Check if any field is marked as default
  const hasDefaultField = useMemo(() => {
    return Object.values(fieldConnections).some(
      (conn) => conn.default === true
    );
  }, [fieldConnections]);

  // Compute ordered field items for display
  const orderedFieldItems = useMemo(() => {
    // Get ordered field IDs from searchParams (source of truth)
    const orderedIds =
      searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
      currentFieldIds;

    // Track which field IDs are in saved parameter data
    const savedFieldIds = new Set(
      parameterData?.field_connections?.map((conn) => conn.field_id) || []
    );

    return orderedIds.map((fieldId, index) => {
      const field = fieldMapping[fieldId];
      const connection = fieldConnections[fieldId];

      // A field is "new" if it's selected but not in saved parameter data
      const isNew = !savedFieldIds.has(fieldId);

      return {
        fieldId,
        fieldName: field?.name || "Unnamed Field",
        fieldDescription: field?.description || "",
        position: index + 1,
        active: connection?.active ?? true,
        default: connection?.default ?? false,
        isNew,
      };
    });
  }, [
    searchParams,
    currentFieldIds,
    fieldMapping,
    fieldConnections,
    parameterData?.field_connections,
  ]);

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!parameterData) return true;
    return !parameterData.can_edit;
  }, [isEditMode, parameterData]);

  // Set first accordion item as open by default when fields are available
  useEffect(() => {
    if (
      orderedFieldItems.length > 0 &&
      openAccordionItem === null &&
      !isReadonly
    ) {
      const firstFieldId = orderedFieldItems[0]?.fieldId;
      if (firstFieldId) {
        setOpenAccordionItem(`field:${firstFieldId}`);
      }
    }
  }, [orderedFieldItems.length, isReadonly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();
      const hasBasicInfo = hasName;
      const hasFields = currentFieldIds.length > 0;

      switch (stepId) {
        case "basic":
          return hasBasicInfo ? "completed" : "active";
        case "parameter-config":
          if (!hasBasicInfo) return "pending";
          return "completed"; // Always completed once basic info is done
        case "fields":
          if (!hasBasicInfo) return "pending";
          return hasFields ? "completed" : "active";
        default:
          // Handle field-specific steps (format: "field-{fieldId}")
          if (stepId.startsWith("field-")) {
            if (!hasFields) return "pending";
            // Always mark as completed since there's nothing to verify
            return "completed";
          }
          return "pending";
      }
    },
    [formData?.name, currentFieldIds.length]
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the parameter name, description, departments, and configuration.",
        status: getStepStatus("basic"),
      },
      {
        id: "parameter-config",
        title: "Parameter Configuration",
        description: "Configure which parameter types this parameter applies to.",
        status: getStepStatus("parameter-config"),
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields to include in this parameter.",
        status: getStepStatus("fields"),
      },
    ];
  }, [getStepStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData) {
      toast.error("Form data is not available");
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(`Validation errors: ${errors.join(", ")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare field connections for submission
      // Use searchParams as source of truth for ordering
      const orderedFieldIds =
        searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
        currentFieldIds;

      const connectionEntries = orderedFieldIds
        .map((fieldId) => [fieldId, fieldConnections[fieldId]] as const)
        .filter(([_, conn]) => conn); // Only include fields with connections

      const defaultCount = connectionEntries.filter(
        ([_, conn]) => conn.default
      ).length;

      // Ensure exactly one default
      let fieldConnectionsToSubmit = connectionEntries.map(
        ([fieldId, conn], index) => ({
          field_id: fieldId,
          default: defaultCount === 0 ? index === 0 : conn.default,
          active: conn.active,
        })
      );

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

      // With server-side access control, effectiveProfile should always exist
      // But handle null gracefully for edge cases
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      const profileId = effectiveProfile.id;

      if (isEditMode) {
        // V3 API: Single atomic update with field connections
        await handleUpdateParameter({
          parameterId: parameterId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          simulation_parameter: formData.simulation_parameter || false,
          document_parameter: formData.document_parameter || false,
          persona_parameter: formData.persona_parameter || false,
          scenario_parameter: formData.scenario_parameter || false,
          video_parameter: formData.video_parameter || false,
          department_ids: formData.departmentIds ?? null,
          field_connections: fieldConnectionsToSubmit,
          profileId,
        });

        toast.success("Parameter updated successfully!");
      } else {
        // V3 API: Single atomic create with field connections
        await handleCreateParameter({
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          simulation_parameter: formData.simulation_parameter || false,
          document_parameter: formData.document_parameter || false,
          persona_parameter: formData.persona_parameter || false,
          scenario_parameter: formData.scenario_parameter || false,
          video_parameter: formData.video_parameter || false,
          department_ids: formData.departmentIds ?? null,
          field_connections: fieldConnectionsToSubmit,
          profileId,
        });

        toast.success("Parameter created successfully!");
      }

      router.push("/management/parameters");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} parameter: ${error}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    // Validate parameter data
    if (!formData?.name?.trim()) {
      errors.push("Parameter name is required");
    }

    // Validate field connections
    const orderedFieldIds =
      searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
      currentFieldIds;
    const connectionEntries = orderedFieldIds
      .map((fieldId) => [fieldId, fieldConnections[fieldId]] as const)
      .filter(([_, conn]) => conn);
    const activeConnections = connectionEntries.filter(
      ([_, conn]) => conn.active
    );

    // Ensure exactly one default field connection
    const defaultCount = activeConnections.filter(
      ([_, conn]) => conn.default
    ).length;
    if (activeConnections.length > 0 && defaultCount !== 1) {
      errors.push("Exactly one field connection must be marked as default");
    }

    return errors;
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData) return false;

    const current = formData;
    const original = originalFormData;

    // Get original field IDs from parameterData
    const originalFieldIds =
      parameterData?.field_connections?.map((conn) => conn.field_id) || [];

    return (
      current.name !== original.name ||
      current.description !== original.description ||
      current.active !== original.active ||
      current.simulation_parameter !== original.simulation_parameter ||
      current.document_parameter !== original.document_parameter ||
      current.persona_parameter !== original.persona_parameter ||
      current.scenario_parameter !== original.scenario_parameter ||
      current.video_parameter !== original.video_parameter ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify([...currentFieldIds].sort()) !==
        JSON.stringify(originalFieldIds.sort()) ||
      JSON.stringify(fieldConnections) !==
        JSON.stringify(originalFieldConnections)
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentFieldIds,
    parameterData?.field_connections,
    fieldConnections,
    originalFieldConnections,
  ]);

  return (
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
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        {formData && (
          <ParameterBasicInfoSection
            name={formData.name || ""}
            description={formData.description || ""}
            departmentIds={formData.departmentIds}
            validDepartmentIds={validDepartmentIds}
            departmentMapping={departmentMapping}
            active={formData.active || false}
            simulation_parameter={formData.simulation_parameter || false}
            document_parameter={formData.document_parameter || false}
            persona_parameter={formData.persona_parameter || false}
            scenario_parameter={formData.scenario_parameter || false}
            video_parameter={formData.video_parameter || false}
            onNameChange={(name) =>
              setFormData((prev) => ({ ...prev, name }))
            }
            onDescriptionChange={(description) =>
              setFormData((prev) => ({ ...prev, description }))
            }
            onDepartmentIdsChange={(ids) =>
              setFormData((prev) => ({ ...prev, departmentIds: ids }))
            }
            onActiveChange={(active) =>
              setFormData((prev) => ({ ...prev, active }))
            }
            onSimulationParameterChange={(enabled) =>
              setFormData((prev) => ({
                ...prev,
                simulation_parameter: enabled,
                // Reset child switches when toggling simulation_parameter
                document_parameter: enabled ? false : prev?.document_parameter ?? false,
                persona_parameter: enabled ? false : prev?.persona_parameter ?? false,
                scenario_parameter: enabled ? false : prev?.scenario_parameter ?? false,
                video_parameter: enabled ? false : prev?.video_parameter ?? false,
              }))
            }
            onDocumentParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, document_parameter: enabled }))
            }
            onPersonaParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, persona_parameter: enabled }))
            }
            onScenarioParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, scenario_parameter: enabled }))
            }
            onVideoParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, video_parameter: enabled }))
            }
            isReadonly={isReadonly}
            stepStatus={getStepStatus("basic")}
            defaultName=""
          />
        )}

        {/* Step 2: Parameter Configuration */}
        {formData && (
          <ParameterConfigurationSection
            simulation_parameter={formData.simulation_parameter || false}
            scenario_parameter={formData.scenario_parameter || false}
            video_parameter={formData.video_parameter || false}
            document_parameter={formData.document_parameter || false}
            persona_parameter={formData.persona_parameter || false}
            onScenarioParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, scenario_parameter: enabled }))
            }
            onVideoParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, video_parameter: enabled }))
            }
            onDocumentParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, document_parameter: enabled }))
            }
            onPersonaParameterChange={(enabled) =>
              setFormData((prev) => ({ ...prev, persona_parameter: enabled }))
            }
            isReadonly={isReadonly}
            stepStatus={getStepStatus("parameter-config")}
          />
        )}

        {/* Step 3: Fields Selection */}
        {parameterData?.field_mapping && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[2]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[2]?.status === "pending" && "opacity-50"
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[2]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[2]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[2]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[2]?.title || "Fields"}
                  </CardTitle>
                  <CardDescription>
                    {steps[2]?.description ||
                      "Select fields to include in this parameter."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              <ParameterFieldCardGrid
                fieldMapping={fieldMapping}
                validFieldIds={validFieldIds}
                selectedFieldIds={
                  // Use searchParams as source of truth for ordering
                  searchParams.get("fieldIds")?.split(",").filter(Boolean) ||
                  currentFieldIds
                }
                onSelect={handleFieldSelect}
                readonly={isReadonly}
              />
            </CardContent>
          </Card>
        )}

        {/* Individual Field Configuration Steps */}
        {orderedFieldItems.length > 0 && (
          <Accordion
            type="single"
            collapsible
            value={openAccordionItem || undefined}
            onValueChange={(value) => setOpenAccordionItem(value || null)}
            className="space-y-4"
          >
            {orderedFieldItems.map((item) => {
              const accordionValue = `field:${item.fieldId}`;
              const stepId = `field-${item.fieldId}`;
              return (
                <ParameterFieldSection
                  key={item.fieldId}
                  fieldId={item.fieldId}
                  fieldName={item.fieldName}
                  fieldDescription={item.fieldDescription}
                  position={item.position}
                  totalItems={orderedFieldItems.length}
                  active={item.active}
                  default={item.default}
                  isNew={item.isNew}
                  onActiveToggle={handleActiveToggle}
                  onDefaultToggle={handleDefaultToggle}
                  onMoveUp={handleFieldMoveUp}
                  onMoveDown={handleFieldMoveDown}
                  readonly={isReadonly}
                  stepStatus={getStepStatus(stepId)}
                  stepNumber={item.position + 3} // After basic (1), config (2), fields (3)
                  isEditMode={isEditMode}
                  showDefaultSwitch={!hasDefaultField}
                  accordionValue={accordionValue}
                  isAccordionOpen={openAccordionItem === accordionValue}
                  onAccordionToggle={(open) =>
                    setOpenAccordionItem(open ? accordionValue : null)
                  }
                />
              );
            })}
          </Accordion>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/management/parameters")}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Back
          </Button>
          <Button
            type="submit"
            data-testid="btn-submit-parameter"
            disabled={
              isSubmitting ||
              (isEditMode && !hasChanges) ||
              isReadonly
            }
            className="w-full sm:w-auto min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Parameter"
            ) : (
              "Create Parameter"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
