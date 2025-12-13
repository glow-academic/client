/**
 * Parameter.tsx
 * Used to create and manage parameters - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DocumentPicker } from "@/components/common/forms/DocumentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  ParameterFieldsTable,
  type FieldConnectionItem,
} from "@/components/common/parameters/ParameterFieldsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import {
  Brain,
  Check,
  FileText,
  PlayCircle,
  Power,
  Users,
  Video,
  X,
} from "lucide-react";

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
  personaIds?: string[];
  documentIds?: string[];
}

interface FieldConnectionState {
  default: boolean;
  active: boolean;
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
      personaIds: [],
      documentIds: [],
    }),
    [defaultDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  // Field connections state: field_id -> { default, active }
  const [fieldConnections, setFieldConnections] = useState<
    Record<string, FieldConnectionState>
  >({});
  const [originalFieldConnections, setOriginalFieldConnections] = useState<
    Record<string, FieldConnectionState>
  >({});

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

  // Parameter items come nested in response (for backward compatibility)
  const parameterItems = useMemo(
    () => parameterData?.parameter_items || [],
    [parameterData]
  );

  // Build field connection items for table
  const fieldConnectionItems = useMemo((): FieldConnectionItem[] => {
    const allFieldIds = parameterData?.valid_field_ids || [];
    const fieldMapping = parameterData?.field_mapping || {};
    const connections = fieldConnections;

    return allFieldIds.map((fieldId) => {
      const field = fieldMapping[fieldId];
      const connection = connections[fieldId];
      const isConnected = !!connection;

      return {
        field_id: fieldId,
        name:
          field && typeof field === "object" && "name" in field
            ? String(field["name"])
            : fieldId,
        description:
          field && typeof field === "object" && "description" in field
            ? String(field["description"] || "")
            : "",
        default: connection?.default || false,
        active: connection?.active ?? true,
        usage_count:
          field && typeof field === "object" && "usage_count" in field
            ? Number(field["usage_count"] || 0)
            : 0,
        isConnected,
      };
    });
  }, [
    parameterData?.valid_field_ids,
    parameterData?.field_mapping,
    fieldConnections,
  ]);

  // Filter personas and documents by selected departments
  const filteredPersonaIds = useMemo(() => {
    const allPersonaIds = parameterData?.valid_persona_ids || [];
    // Server already filters by parameter departments, so we can use all valid IDs
    return allPersonaIds;
  }, [parameterData?.valid_persona_ids]);

  const filteredDocumentIds = useMemo(() => {
    const allDocumentIds = parameterData?.valid_document_ids || [];
    // Server already filters by parameter departments
    return allDocumentIds;
  }, [parameterData?.valid_document_ids]);

  const filteredPersonaMapping = useMemo(() => {
    const mapping = parameterData?.persona_mapping || {};
    const filtered: Record<string, Record<string, unknown>> = {};
    filteredPersonaIds.forEach((id) => {
      if (mapping[id]) {
        filtered[id] = mapping[id] as Record<string, unknown>;
      }
    });
    return filtered;
  }, [parameterData?.persona_mapping, filteredPersonaIds]);

  const filteredDocumentMapping = useMemo(() => {
    const mapping = parameterData?.document_mapping || {};
    const filtered: Record<string, Record<string, unknown>> = {};
    filteredDocumentIds.forEach((id) => {
      if (mapping[id]) {
        filtered[id] = mapping[id] as Record<string, unknown>;
      }
    });
    return filtered;
  }, [parameterData?.document_mapping, filteredDocumentIds]);

  const [initiallySorted, setInitiallySorted] = useState(false);

  // Initialize form data from v3 response
  useEffect(() => {
    if (isEditMode && parameterData) {
      setFormData({
        name: parameterData.name,
        description: parameterData.description,
        active: parameterData.active,
        simulation_parameter: parameterData.simulation_parameter ?? false,
        document_parameter: parameterData.document_parameter ?? false,
        persona_parameter: parameterData.persona_parameter ?? false,
        scenario_parameter: parameterData.scenario_parameter ?? false,
        video_parameter: parameterData.video_parameter ?? false,
        departmentIds: parameterData.department_ids || null,
        personaIds: parameterData.persona_ids || [],
        documentIds: parameterData.document_ids || [],
      });
    } else if (!isEditMode && parameterData) {
      // For create mode, use data from default detail endpoint
      setFormData({
        ...initialFormData,
        departmentIds:
          defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
      });
    }
  }, [parameterData, isEditMode, initialFormData, defaultDepartmentIds]);

  // Initialize parameter items from v3 nested data (for backward compatibility)
  useEffect(() => {
    if (!initiallySorted && parameterItems && parameterItems.length > 0) {
      setInitiallySorted(true);
    }
  }, [initiallySorted, parameterItems]);

  // Initialize field connections from server data
  useEffect(() => {
    if (isEditMode && parameterData?.field_connections) {
      const connections: Record<string, FieldConnectionState> = {};
      const originalConnections: Record<string, FieldConnectionState> = {};
      parameterData.field_connections.forEach((conn) => {
        connections[conn.field_id] = {
          default: conn.default,
          active: conn.active,
        };
        originalConnections[conn.field_id] = {
          default: conn.default,
          active: conn.active,
        };
      });
      setFieldConnections(connections);
      setOriginalFieldConnections(originalConnections);
    } else if (!isEditMode) {
      // Reset for create mode
      setFieldConnections({});
      setOriginalFieldConnections({});
    }
  }, [isEditMode, parameterData?.field_connections]);

  // Update parameter items when data changes (for edit mode)
  useEffect(() => {
    if (mode === "create") {
      return;
    }
    if (!parameterItems) return;
    if (!initiallySorted) return; // wait until initial sort hook runs
    // Note: parameterItems are already sorted and mapped by the parent component
  }, [parameterItems, mode, initiallySorted]);

  // Handlers for field connections
  const handleFieldSelect = useCallback((fieldIds: string[]) => {
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
  }, []);

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

  const handleRemoveConnection = useCallback((fieldId: string) => {
    setFieldConnections((prev) => {
      const updated = { ...prev };
      delete updated[fieldId];
      return updated;
    });
  }, []);

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
      const connectionEntries = Object.entries(fieldConnections);
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

      const profileId = effectiveProfile?.id || "guest-profile-id";

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
          persona_ids:
            formData.personaIds && formData.personaIds.length > 0
              ? formData.personaIds
              : null,
          document_ids:
            formData.documentIds && formData.documentIds.length > 0
              ? formData.documentIds
              : null,
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
          persona_ids:
            formData.personaIds && formData.personaIds.length > 0
              ? formData.personaIds
              : null,
          document_ids:
            formData.documentIds && formData.documentIds.length > 0
              ? formData.documentIds
              : null,
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
    if (!formData?.description?.trim()) {
      errors.push("Parameter description is required");
    }

    // Validate field connections
    const connectionEntries = Object.entries(fieldConnections);
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

  // (deprecated) visible items helper removed; we filter inline in the render

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!parameterData) return true;
    return !parameterData.can_edit;
  }, [isEditMode, parameterData]);

  return (
    <div className="space-y-6 py-4 px-4">
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
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Parameter Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Parameter Name *</Label>
              {formData?.name !== undefined ? (
                <Input
                  id="name"
                  data-testid="input-parameter-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Difficulty Level"
                  required
                  disabled={
                    !!(
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    )
                  }
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-parameter-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed description of the parameter"
                  rows={4}
                  required
                  disabled={
                    !!(
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    )
                  }
                />
              ) : null}
            </div>

            {/* Department Selection */}
            {validDepartmentIds.length > 1 && (
              <div className="space-y-2">
                <Label>Departments</Label>
                {formData?.departmentIds !== undefined ? (
                  <GenericPicker
                    items={departmentMapping}
                    itemIds={validDepartmentIds}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentIds: ids.length > 0 ? ids : null,
                      }))
                    }
                    getId={(dept) => (dept as unknown as { id: string }).id}
                    getLabel={(dept) => dept.name || ""}
                    getSearchText={(dept) =>
                      `${dept.name} ${dept.description || ""}`
                    }
                    placeholder="All Departments"
                    multiSelect={true}
                    hideSelectedChips={true}
                    disabled={
                      !!(
                        isEditMode &&
                        parameterDetail &&
                        !parameterDetail.can_edit
                      )
                    }
                    buttonClassName="w-full"
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Leave empty to make this parameter available to all
                  departments
                </p>
              </div>
            )}

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
                  {formData?.active !== undefined ? (
                    <Switch
                      id="active"
                      data-testid="switch-parameter-active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, active: checked }))
                      }
                      disabled={
                        isEditMode &&
                        parameterDetail &&
                        !parameterDetail.can_edit
                      }
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive parameters will not be available for scenarios
                </p>
              </div>
            </div>

            {/* Simulation Parameter Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="simulation_parameter"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    Simulation Parameter
                  </Label>
                  {formData?.simulation_parameter !== undefined ? (
                    <Switch
                      id="simulation_parameter"
                      data-testid="switch-parameter-simulation"
                      checked={formData.simulation_parameter}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          simulation_parameter: checked,
                          // Reset child switches when toggling simulation_parameter
                          document_parameter: checked
                            ? false
                            : (prev?.document_parameter ?? false),
                          persona_parameter: checked
                            ? false
                            : (prev?.persona_parameter ?? false),
                          scenario_parameter: checked
                            ? false
                            : (prev?.scenario_parameter ?? false),
                          video_parameter: checked
                            ? false
                            : (prev?.video_parameter ?? false),
                        }))
                      }
                      disabled={
                        isEditMode &&
                        parameterDetail &&
                        !parameterDetail.can_edit
                      }
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Enable to use this parameter for simulation analysis
                  (scenarios/videos)
                </p>
              </div>
            </div>

            {/* Conditional Switches Based on Simulation Parameter */}
            {formData?.simulation_parameter === false ? (
              <>
                {/* Persona Parameter Switch */}
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="persona_parameter"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        Persona Parameter
                      </Label>
                      {formData?.persona_parameter !== undefined ? (
                        <Switch
                          id="persona_parameter"
                          data-testid="switch-parameter-persona"
                          checked={formData.persona_parameter}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              persona_parameter: checked,
                            }))
                          }
                          disabled={
                            isEditMode &&
                            parameterDetail &&
                            !parameterDetail.can_edit
                          }
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Link this parameter to specific personas
                    </p>
                  </div>
                </div>

                {/* Document Parameter Switch */}
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="document_parameter"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        Document Parameter
                      </Label>
                      {formData?.document_parameter !== undefined ? (
                        <Switch
                          id="document_parameter"
                          data-testid="switch-parameter-document"
                          checked={formData.document_parameter}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              document_parameter: checked,
                            }))
                          }
                          disabled={
                            isEditMode &&
                            parameterDetail &&
                            !parameterDetail.can_edit
                          }
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Link this parameter to specific documents
                    </p>
                  </div>
                </div>
              </>
            ) : formData?.simulation_parameter === true ? (
              <>
                {/* Scenario Parameter Switch */}
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="scenario_parameter"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        Scenario Parameter
                      </Label>
                      {formData?.scenario_parameter !== undefined ? (
                        <Switch
                          id="scenario_parameter"
                          data-testid="switch-parameter-scenario"
                          checked={formData.scenario_parameter}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              scenario_parameter: checked,
                            }))
                          }
                          disabled={
                            isEditMode &&
                            parameterDetail &&
                            !parameterDetail.can_edit
                          }
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Enable for scenario analysis (links populated
                      after-the-fact)
                    </p>
                  </div>
                </div>

                {/* Video Parameter Switch */}
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="video_parameter"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                        Video Parameter
                      </Label>
                      {formData?.video_parameter !== undefined ? (
                        <Switch
                          id="video_parameter"
                          data-testid="switch-parameter-video"
                          checked={formData.video_parameter}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              video_parameter: checked,
                            }))
                          }
                          disabled={
                            isEditMode &&
                            parameterDetail &&
                            !parameterDetail.can_edit
                          }
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Enable for video analysis (links populated after-the-fact)
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {/* Show Persona Picker when persona_parameter is true */}
            {formData?.persona_parameter === true &&
              parameterData?.persona_mapping && (
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <Label>Link to Personas</Label>
                  {formData?.personaIds !== undefined ? (
                    <GenericPicker
                      items={
                        filteredPersonaMapping as Record<
                          string,
                          {
                            name: string;
                            description: string;
                            color: string;
                            icon: string;
                            image_model?: boolean | null;
                          }
                        >
                      }
                      itemIds={filteredPersonaIds}
                      selectedIds={formData.personaIds}
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          personaIds: ids,
                        }))
                      }
                      getId={(persona) =>
                        (persona as unknown as { id: string }).id
                      }
                      getLabel={(persona) => persona.name || ""}
                      getSearchText={(persona) =>
                        `${persona.name} ${persona.description || ""}`
                      }
                      renderItem={(persona, isSelected) => {
                        const IconComponent =
                          getPersonaIconComponent(persona.icon) || Brain;
                        const hexColor = persona.color || "#64748b";
                        const generateGradient = (hex: string) => {
                          const cleanHex = hex.replace("#", "");
                          const r = parseInt(cleanHex.substr(0, 2), 16);
                          const g = parseInt(cleanHex.substr(2, 2), 16);
                          const b = parseInt(cleanHex.substr(4, 2), 16);
                          const lighterR = Math.min(255, r + 60);
                          const lighterG = Math.min(255, g + 60);
                          const lighterB = Math.min(255, b + 60);
                          const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                          return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                        };
                        return (
                          <div className="flex items-center gap-3 w-full">
                            <div
                              className="p-2 rounded-lg shadow-lg flex-shrink-0"
                              style={{
                                background: generateGradient(hexColor),
                              }}
                            >
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {persona.name}
                              </div>
                              {persona.description && (
                                <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                  {persona.description}
                                </div>
                              )}
                            </div>
                            <Check
                              className={cn(
                                "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </div>
                        );
                      }}
                      renderButton={(selectedItems) => {
                        if (selectedItems.length === 0) return "Select persona";
                        if (selectedItems.length === 1) {
                          const persona = selectedItems[0];
                          const IconComponent =
                            (persona?.icon ? getPersonaIconComponent(persona.icon) : null) || Brain;
                          const hexColor = persona?.color || "#64748b";
                          const generateGradient = (hex: string) => {
                            const cleanHex = hex.replace("#", "");
                            const r = parseInt(cleanHex.substr(0, 2), 16);
                            const g = parseInt(cleanHex.substr(2, 2), 16);
                            const b = parseInt(cleanHex.substr(4, 2), 16);
                            const lighterR = Math.min(255, r + 60);
                            const lighterG = Math.min(255, g + 60);
                            const lighterB = Math.min(255, b + 60);
                            const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                            return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                          };
                          return (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className="p-1 rounded-md shadow-sm flex-shrink-0"
                                style={{
                                  background: generateGradient(hexColor),
                                }}
                              >
                                <IconComponent className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="truncate">
                                {persona?.name || "Select persona"}
                              </span>
                            </div>
                          );
                        }
                        return `${selectedItems.length} selected`;
                      }}
                      renderChip={(persona, onRemove) => (
                        <div
                          key={(persona as unknown as { id: string }).id}
                          className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
                        >
                          <span className="truncate">{persona.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove();
                            }}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      placeholder="Select personas..."
                      multiSelect={true}
                      hideSelectedChips={false}
                      disabled={
                        !!(
                          isEditMode &&
                          parameterDetail &&
                          !parameterDetail.can_edit
                        )
                      }
                      buttonClassName="w-full"
                      groupHeading="Personas"
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Select which personas this parameter applies to (filtered by
                    selected departments)
                  </p>
                </div>
              )}

            {/* Show Document Picker when document_parameter is true */}
            {formData?.document_parameter === true &&
              parameterData?.document_mapping && (
                <div className="space-y-2 pt-2 pl-4 border-l-2 border-muted">
                  <Label>Link to Documents</Label>
                  {formData?.documentIds !== undefined ? (
                    <DocumentPicker
                      mapping={
                        filteredDocumentMapping as Record<
                          string,
                          {
                            name: string;
                            description: string;
                            tags?: string[];
                            filePath?: string;
                            mimeType?: string;
                          }
                        >
                      }
                      validIds={filteredDocumentIds}
                      selectedIds={formData.documentIds}
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          documentIds: ids,
                        }))
                      }
                      placeholder="Select documents..."
                      multiSelect={true}
                      disabled={
                        !!(
                          isEditMode &&
                          parameterDetail &&
                          !parameterDetail.can_edit
                        )
                      }
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Select which documents this parameter applies to (filtered
                    by selected departments)
                  </p>
                </div>
              )}
          </div>

          {/* Field Connections Section */}
          {parameterData?.field_mapping && (
            <div className="space-y-4">
              <ParameterFieldsTable
                data={fieldConnectionItems}
                fieldMapping={
                  parameterData.field_mapping as Record<
                    string,
                    {
                      name: string;
                      description?: string;
                      usage_count?: number;
                      department_ids?: string[] | null;
                    }
                  >
                }
                validFieldIds={parameterData.valid_field_ids || []}
                selectedFieldIds={Object.keys(fieldConnections)}
                onFieldSelect={handleFieldSelect}
                onDefaultToggle={handleDefaultToggle}
                onActiveToggle={handleActiveToggle}
                onRemoveConnection={handleRemoveConnection}
                readonly={isReadonly}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-4 border-t">
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
                (isEditMode &&
                  JSON.stringify(formData) ===
                    JSON.stringify({
                      name: parameterData?.name,
                      description: parameterData?.description,
                      active: parameterData?.active,
                      simulation_parameter:
                        parameterData?.simulation_parameter ?? false,
                      document_parameter:
                        parameterData?.document_parameter ?? false,
                      persona_parameter:
                        parameterData?.persona_parameter ?? false,
                      scenario_parameter:
                        parameterData?.scenario_parameter ?? false,
                      video_parameter: parameterData?.video_parameter ?? false,
                      departmentIds: parameterData?.department_ids,
                      personaIds: parameterData?.persona_ids || [],
                      documentIds: parameterData?.document_ids || [],
                    }) &&
                  JSON.stringify(fieldConnections) ===
                    JSON.stringify(originalFieldConnections))
              }
              className="w-full sm:w-auto"
            >
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Parameter"
                  : "Create Parameter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
