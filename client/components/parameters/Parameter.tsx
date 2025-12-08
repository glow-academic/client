/**
 * Parameter.tsx
 * Used to create and manage parameters - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { DocumentPicker } from "@/components/common/forms/DocumentPicker";
import { PersonaPicker } from "@/components/common/forms/PersonaPicker";
import { ScenarioPicker } from "@/components/common/forms/ScenarioPicker";
import { VideoPicker } from "@/components/common/forms/VideoPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  GraduationCap,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

// Type-only import from server page
import type {
  CreateParameterIn,
  CreateParameterOut,
  ParameterNewOut,
  ParameterDetailOut,
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
  practice_parameter?: boolean;
  departmentIds?: string[] | null;
  personaIds?: string[];
  documentIds?: string[];
  scenarioIds?: string[];
  videoIds?: string[];
}

interface ParameterItemFormData {
  id?: string;
  name: string;
  description: string;
  default: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
  canDelete?: boolean;
  departmentIds?: string[] | null;
}

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  // Optional server-provided data and actions (for server-side rendering)
  parameterDetail?: ParameterDetailOut;
  parameterDetailDefault?: ParameterNewOut;
  createParameterAction?: (
    input: CreateParameterIn,
  ) => Promise<CreateParameterOut>;
  updateParameterAction?: (
    input: UpdateParameterIn,
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
        effectiveProfile?.primaryDepartmentId || null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      active: false,
      practice_parameter: false,
      departmentIds:
        defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
      personaIds: [],
      documentIds: [],
      scenarioIds: [],
      videoIds: [],
    }),
    [defaultDepartmentIds],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [parameterItemsFormData, setParameterItemsFormData] = useState<
    ParameterItemFormData[]
  >([]);

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
    [parameterData],
  );

  const validDepartmentIds = useMemo(
    () => parameterData?.valid_department_ids || [],
    [parameterData],
  );

  // Parameter items come nested in response
  const parameterItems = useMemo(
    () => parameterData?.parameter_items || [],
    [parameterData],
  );

  const [initiallySorted, setInitiallySorted] = useState(false);

  // Initialize form data from v3 response
  useEffect(() => {
    if (isEditMode && parameterData) {
      setFormData({
        name: parameterData.name,
        description: parameterData.description,
        active: parameterData.active,
        practice_parameter: parameterData.practice_parameter ?? false,
        departmentIds: parameterData.department_ids || null,
        personaIds: parameterData.persona_ids || [],
        documentIds: parameterData.document_ids || [],
        scenarioIds: parameterData.scenario_ids || [],
        videoIds: parameterData.video_ids || [],
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

  // Initialize parameter items from v3 nested data
  useEffect(() => {
    if (!initiallySorted && parameterItems && parameterItems.length > 0) {
      const sorted = parameterItems
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const formData = sorted.map((item) => ({
        id: item.parameter_item_id,
        name: item.name,
        description: item.description,
        default: item.default ?? false,
        // V3 response has usage_count, derive canDelete from it
        canDelete: (item.usage_count ?? 0) === 0,
        departmentIds: item.department_ids ?? null,
        isNew: false,
        isDeleted: false,
      }));
      setParameterItemsFormData(formData);
      setInitiallySorted(true);
    }
  }, [initiallySorted, parameterItems]);

  // Update parameter items when data changes (for edit mode)
  useEffect(() => {
    if (mode === "create") {
      return;
    }
    if (!parameterItems) return;
    if (!initiallySorted) return; // wait until initial sort hook runs

      const mapped = parameterItems
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          id: item.parameter_item_id,
          name: item.name,
          description: item.description,
          default: item.default ?? false,
          // V3 response has usage_count, derive canDelete from it
          canDelete: (item.usage_count ?? 0) === 0,
          departmentIds: item.department_ids ?? null,
          isNew: false,
          isDeleted: false,
        }));
    setParameterItemsFormData(mapped);
  }, [parameterItems, mode, initiallySorted]);

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
      // Prepare parameter items for submission (only non-deleted items)
      // Transform department_ids for each item (non-superadmin: empty -> all valid departments)
      // Ensure exactly one default item
      const activeItems = parameterItemsFormData.filter((item) => !item.isDeleted);
      const defaultCount = activeItems.filter((item) => item.default).length;
      
      // If no default or multiple defaults, set first item as default
      let itemsToSubmit = activeItems.map((item, index) => {
        const itemDepartmentIds = item.departmentIds || [];
        const transformedDepartmentIds = transformDepartmentIdsForSubmit(
          itemDepartmentIds,
          isSuperadmin,
          validDepartmentIds,
        );
        return {
          name: item.name,
          description: item.description,
          default: defaultCount === 0 ? index === 0 : item.default,
          department_ids: transformedDepartmentIds,
        };
      });
      
      // Ensure exactly one default
      if (defaultCount === 0 && itemsToSubmit.length > 0) {
        itemsToSubmit[0].default = true;
      } else if (defaultCount > 1) {
        // Keep only the first default, set others to false
        let foundFirst = false;
        itemsToSubmit = itemsToSubmit.map((item) => {
          if (item.default && !foundFirst) {
            foundFirst = true;
            return { ...item, default: true };
          }
          return { ...item, default: false };
        });
      }
      
      const parameter_items = itemsToSubmit;

      if (isEditMode) {
        // V3 API: Single atomic update with nested items
        await handleUpdateParameter({
          parameterId: parameterId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          practice_parameter: formData.practice_parameter || false,
          department_ids: formData.departmentIds ?? null,
          parameter_items,
          persona_ids: formData.personaIds && formData.personaIds.length > 0 ? formData.personaIds : null,
          document_ids: formData.documentIds && formData.documentIds.length > 0 ? formData.documentIds : null,
          scenario_ids: formData.scenarioIds && formData.scenarioIds.length > 0 ? formData.scenarioIds : null,
          video_ids: formData.videoIds && formData.videoIds.length > 0 ? formData.videoIds : null,
        });

        toast.success("Parameter updated successfully!");
      } else {
        // V3 API: Single atomic create with nested items
        await handleCreateParameter({
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          practice_parameter: formData.practice_parameter || false,
          department_ids: formData.departmentIds ?? null,
          parameter_items,
          persona_ids: formData.personaIds && formData.personaIds.length > 0 ? formData.personaIds : null,
          document_ids: formData.documentIds && formData.documentIds.length > 0 ? formData.documentIds : null,
          scenario_ids: formData.scenarioIds && formData.scenarioIds.length > 0 ? formData.scenarioIds : null,
          video_ids: formData.videoIds && formData.videoIds.length > 0 ? formData.videoIds : null,
        });

        toast.success("Parameter created successfully!");
      }

      router.push("/management/parameters");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} parameter: ${error}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParameterItemInputChange = (
    itemIndex: number,
    field: keyof ParameterItemFormData,
    value: string | boolean | string[] | null,
  ) => {
    setParameterItemsFormData((prev) => {
      const updated = [...prev];
      const activeItems = updated.filter((item) => !item.isDeleted);
      
      // If setting default to true, ensure only one default
      if (field === "default" && value === true) {
        // Set all other items' default to false
        activeItems.forEach((item, idx) => {
          if (idx !== itemIndex) {
            item.default = false;
          }
        });
      }
      
      updated[itemIndex] = { ...updated[itemIndex]!, [field]: value };
      return updated;
    });
  };

  const handleAddParameterItem = () => {
    const activeItems = parameterItemsFormData.filter((item) => !item.isDeleted);
    const hasDefault = activeItems.some((item) => item.default);
    
    const newItem: ParameterItemFormData = {
      name: "",
      description: "",
      default: !hasDefault, // Set as default if no other item is default
      isNew: true,
      isDeleted: false,
      departmentIds:
        defaultDepartmentIds.length > 0 ? defaultDepartmentIds : null,
    };
    
    // If setting this as default, unset others
    if (newItem.default) {
      setParameterItemsFormData((prev) => {
        const updated = prev.map((item) => ({
          ...item,
          default: false,
        }));
        return [...updated, newItem];
      });
    } else {
      setParameterItemsFormData((prev) => [...prev, newItem]);
    }
  };

  const handleDeleteParameterItem = (itemIndex: number) => {
    setParameterItemsFormData((prev) => {
      const updated = [...prev];
      const item = updated[itemIndex]!;

      if (item.isNew) {
        // Remove new items completely
        return updated.filter((_, i) => i !== itemIndex);
      } else {
        // Mark existing items for deletion
        updated[itemIndex] = { ...item, isDeleted: true };
        return updated;
      }
    });
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

    // Validate parameter items
    const activeItems = parameterItemsFormData.filter(
      (item) => !item.isDeleted,
    );

    activeItems.forEach((item, index) => {
      if (!item.name.trim()) {
        errors.push(`Parameter item ${index + 1}: Name is required`);
      }
      if (!item.description.trim()) {
        errors.push(`Parameter item ${index + 1}: Description is required`);
      }
    });
    
    // Ensure exactly one default item
    const defaultCount = activeItems.filter((item) => item.default).length;
    if (defaultCount !== 1) {
      errors.push("Exactly one parameter item must be marked as default");
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
                    isEditMode && parameterDetail && !parameterDetail.can_edit
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
                    isEditMode && parameterDetail && !parameterDetail.can_edit
                  }
                />
              ) : null}
            </div>

            {/* Department Selection */}
            {validDepartmentIds.length > 1 && (
              <div className="space-y-2">
                <Label>Departments</Label>
                {formData?.departmentIds !== undefined ? (
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={validDepartmentIds}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentIds: ids.length > 0 ? ids : null,
                      }))
                    }
                    placeholder="All Departments"
                    multiSelect={true}
                    disabled={
                      isEditMode && parameterDetail && !parameterDetail.can_edit
                    }
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


            {/* Persona Links */}
            {parameterData?.persona_mapping && (
              <div className="space-y-2">
                <Label>Link to Personas</Label>
                {formData?.personaIds !== undefined ? (
                  <PersonaPicker
                    mapping={parameterData.persona_mapping}
                    validIds={parameterData.valid_persona_ids || []}
                    selectedIds={formData.personaIds}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        personaIds: ids,
                      }))
                    }
                    placeholder="Select personas..."
                    multiSelect={true}
                    disabled={
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    }
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select which personas this parameter applies to
                </p>
              </div>
            )}

            {/* Document Links */}
            {parameterData?.document_mapping && (
              <div className="space-y-2">
                <Label>Link to Documents</Label>
                {formData?.documentIds !== undefined ? (
                  <DocumentPicker
                    mapping={parameterData.document_mapping}
                    validIds={parameterData.valid_document_ids || []}
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
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    }
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select which documents this parameter applies to
                </p>
              </div>
            )}

            {/* Scenario Links */}
            {parameterData?.scenario_mapping && (
              <div className="space-y-2">
                <Label>Link to Scenarios</Label>
                {formData?.scenarioIds !== undefined ? (
                  <ScenarioPicker
                    scenarioMapping={parameterData.scenario_mapping}
                    validScenarioIds={parameterData.valid_scenario_ids || []}
                    selectedScenarioIds={formData.scenarioIds}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        scenarioIds: ids,
                      }))
                    }
                    placeholder="Select scenarios..."
                    disabled={
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    }
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select which scenarios this parameter applies to
                </p>
              </div>
            )}

            {/* Video Links */}
            {parameterData?.video_mapping && (
              <div className="space-y-2">
                <Label>Link to Videos</Label>
                {formData?.videoIds !== undefined ? (
                  <VideoPicker
                    videoMapping={parameterData.video_mapping}
                    validVideoIds={parameterData.valid_video_ids || []}
                    selectedVideoIds={formData.videoIds}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        videoIds: ids,
                      }))
                    }
                    placeholder="Select videos..."
                    disabled={
                      isEditMode &&
                      parameterDetail &&
                      !parameterDetail.can_edit
                    }
                  />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Select which videos this parameter applies to
                </p>
              </div>
            )}

            {/* Practice Parameter Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="practice_parameter"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                    Practice
                  </Label>
                  {formData?.practice_parameter !== undefined ? (
                    <Switch
                      id="practice_parameter"
                      data-testid="switch-parameter-practice"
                      checked={formData.practice_parameter}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          practice_parameter: checked,
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
                  This shows up as a custom practice option
                </p>
              </div>
            </div>
          </div>

          {/* Parameter Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                onClick={handleAddParameterItem}
                size="sm"
                variant="default"
                data-testid="btn-add-parameter-item"
                className="w-full sm:w-auto"
                disabled={isReadonly}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>

            {parameterItemsFormData.some((i) => !i.isDeleted) ? (
              <>
                {/* Mobile: Stacked card view */}
                <div className="md:hidden space-y-4">
                  {parameterItemsFormData.map((item, itemIndex) =>
                    item.isDeleted ? null : (
                      <div
                        key={item.id || `new-${itemIndex}`}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleParameterItemInputChange(
                                  itemIndex,
                                  "name",
                                  e.target.value,
                                )
                              }
                              className="text-sm font-medium w-full"
                              placeholder="Item name"
                              disabled={isReadonly}
                            />
                          </div>
                          {item.canDelete !== false && !isReadonly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteParameterItem(itemIndex)
                              }
                              aria-label="Delete parameter item"
                              className="h-8 w-8 p-0 flex-shrink-0"
                              data-testid="btn-delete-parameter-item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div>
                          <Textarea
                            value={item.description}
                            onChange={(e) =>
                              handleParameterItemInputChange(
                                itemIndex,
                                "description",
                                e.target.value,
                              )
                            }
                            className="text-sm min-h-[80px] w-full"
                            rows={3}
                            placeholder="Item description"
                            disabled={isReadonly}
                          />
                        </div>
                        {/* Default Switch */}
                        <div className="flex items-center gap-2 pt-2">
                          <Label
                            htmlFor={`default-${itemIndex}`}
                            className="text-xs text-muted-foreground flex items-center gap-1.5"
                          >
                            <Power className="h-3 w-3 text-muted-foreground" />
                            Default
                          </Label>
                          <Switch
                            id={`default-${itemIndex}`}
                            checked={item.default}
                            onCheckedChange={(checked) =>
                              handleParameterItemInputChange(
                                itemIndex,
                                "default",
                                checked,
                              )
                            }
                            disabled={isReadonly}
                            data-testid={`switch-item-default-${itemIndex}`}
                          />
                        </div>
                        {validDepartmentIds.length > 1 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Departments
                            </Label>
                            <DepartmentPicker
                              mapping={departmentMapping}
                              validIds={validDepartmentIds}
                              selectedIds={item.departmentIds || []}
                              onSelect={(ids) =>
                                handleParameterItemInputChange(
                                  itemIndex,
                                  "departmentIds",
                                  ids.length > 0 ? ids : null,
                                )
                              }
                              placeholder="All Departments"
                              multiSelect={true}
                              disabled={isReadonly}
                              triggerProps={{
                                "data-testid": "picker-department",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>

                {/* Desktop: Table view */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48">Name</TableHead>
                        <TableHead className="w-80">Description</TableHead>
                        <TableHead className="w-24">Default</TableHead>
                        <TableHead className="w-64">Departments</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parameterItemsFormData.map((item, itemIndex) =>
                        item.isDeleted ? null : (
                          <TableRow key={item.id || `new-${itemIndex}`}>
                            <TableCell className="w-48">
                              <Input
                                value={item.name}
                                onChange={(e) =>
                                  handleParameterItemInputChange(
                                    itemIndex,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                className="text-sm"
                                placeholder="Item name"
                                disabled={isReadonly}
                              />
                            </TableCell>
                            <TableCell className="w-80">
                              <Textarea
                                value={item.description}
                                onChange={(e) =>
                                  handleParameterItemInputChange(
                                    itemIndex,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="text-sm min-h-[96px]"
                                rows={4}
                                placeholder="Item description"
                                disabled={isReadonly}
                              />
                            </TableCell>
                            <TableCell className="w-24">
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={item.default}
                                  onCheckedChange={(checked) =>
                                    handleParameterItemInputChange(
                                      itemIndex,
                                      "default",
                                      checked,
                                    )
                                  }
                                  disabled={isReadonly}
                                  data-testid={`switch-item-default-${itemIndex}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="w-64">
                              {validDepartmentIds.length > 1 ? (
                                <DepartmentPicker
                                  mapping={departmentMapping}
                                  validIds={validDepartmentIds}
                                  selectedIds={item.departmentIds || []}
                                  onSelect={(ids) =>
                                    handleParameterItemInputChange(
                                      itemIndex,
                                      "departmentIds",
                                      ids.length > 0 ? ids : null,
                                    )
                                  }
                                  placeholder="All Departments"
                                  multiSelect={true}
                                  disabled={isReadonly}
                                  triggerProps={{
                                    "data-testid": "picker-department",
                                  }}
                                />
                              ) : null}
                            </TableCell>
                            <TableCell className="w-20">
                              <div className="flex items-center gap-1">
                                {item.canDelete !== false && !isReadonly && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleDeleteParameterItem(itemIndex)
                                        }
                                        aria-label="Delete parameter item"
                                        className="pb-1"
                                        data-testid="btn-delete-parameter-item"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Delete parameter item
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No parameter items added yet.</p>
                <p className="text-sm">
                  Click "Add Item" to create your first parameter item.
                </p>
              </div>
            )}
          </div>

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
                      departmentIds: null,
                    }) &&
                  JSON.stringify(parameterItemsFormData) ===
                    JSON.stringify(
                      (parameterItems || []).map((item) => ({
                        id: item.parameter_item_id,
                        name: item.name,
                        description: item.description,
                        default: item.default ?? false,
                        canDelete: (item.usage_count ?? 0) === 0,
                        departmentIds: item.department_ids ?? null,
                        isNew: false,
                        isDeleted: false,
                      })),
                    ))
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
