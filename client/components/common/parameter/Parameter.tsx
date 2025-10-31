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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  useCreateParameter,
  useParameterDetail,
  useParameterDetailDefault,
  useUpdateParameter,
} from "@/lib/api/v2/hooks/parameters";
import { Plus, Trash2 } from "lucide-react";

interface FormData {
  name?: string;
  description?: string;
  numerical?: boolean;
  active?: boolean;
  departmentIds?: string[] | null;
}

interface ParameterItemFormData {
  id?: string;
  name: string;
  description: string;
  value: string;
  isNew?: boolean;
  isDeleted?: boolean;
  defaultItem?: boolean;
  canDelete?: boolean;
  departmentIds?: string[] | null;
}

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
}

export default function Parameter({
  parameterId,
  mode = parameterId ? "edit" : "create",
}: ParameterProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!parameterId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      numerical: false,
      active: false,
      departmentIds: null, // No longer used at parameter level
    }),
    []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [parameterItemsFormData, setParameterItemsFormData] = useState<
    ParameterItemFormData[]
  >([]);

  // V2 API hooks - single hook for all data
  const { data: parameterDetail, isLoading: isLoadingParameterDetail } =
    useParameterDetail(
      parameterId || "",
      effectiveProfile?.id || "",
      !!parameterId && isEditMode
    );

  const { data: parameterDetailDefault, isLoading: isLoadingParameterDefault } =
    useParameterDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const parameterData = isEditMode ? parameterDetail : parameterDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingParameterDetail
    : isLoadingParameterDefault;

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

  // Extract mappings from v2 response
  const departmentMapping = useMemo(
    () => parameterData?.department_mapping || {},
    [parameterData]
  );

  const validDepartmentIds = useMemo(
    () => parameterData?.valid_department_ids || [],
    [parameterData]
  );

  // Parameter items come nested in response
  const parameterItems = useMemo(
    () => parameterData?.parameter_items || [],
    [parameterData]
  );

  // V2 Mutation hooks
  const createParameterMutation = useCreateParameter();
  const updateParameterMutation = useUpdateParameter();

  const isLoading = isLoadingData;

  const [initiallySorted, setInitiallySorted] = useState(false);

  // Initialize form data from v2 response
  useEffect(() => {
    if (isEditMode && parameterData) {
      setFormData({
        name: parameterData.name,
        description: parameterData.description,
        numerical: parameterData.numerical,
        active: parameterData.active,
        departmentIds: null, // No longer used at parameter level
      });
    } else if (!isEditMode && parameterData) {
      // For create mode, use data from default detail endpoint
      setFormData({
        ...initialFormData,
        departmentIds: null, // No longer used at parameter level
      });
    }
  }, [parameterData, isEditMode, initialFormData]);

  // Initialize parameter items from v2 nested data
  useEffect(() => {
    if (!initiallySorted && parameterItems && parameterItems.length > 0) {
      const sorted = parameterItems
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const formData = sorted.map((item) => ({
        id: item.parameter_item_id,
        name: item.name,
        description: item.description,
        value: item.value,
        defaultItem: item.default_item ?? false,
        canDelete: item.can_delete,
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
        value: item.value,
        defaultItem: item.default_item ?? false,
        canDelete: item.can_delete,
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
      const parameter_items = parameterItemsFormData
        .filter((item) => !item.isDeleted)
        .map((item) => ({
          name: item.name,
          description: item.description,
          value: formData.numerical ? item.value : item.name,
          default_item: !!item.defaultItem,
          department_ids: item.departmentIds ?? null,
        }));

      if (isEditMode) {
        // V2 API: Single atomic update with nested items
        await updateParameterMutation.mutateAsync({
          parameterId: parameterId!,
          name: formData.name!,
          description: formData.description!,
          numerical: formData.numerical || false,
          active: formData.active || false,
          parameter_items,
        });

        toast.success("Parameter updated successfully!");
      } else {
        // V2 API: Single atomic create with nested items
        await createParameterMutation.mutateAsync({
          name: formData.name!,
          description: formData.description!,
          numerical: formData.numerical || false,
          active: formData.active || false,
          parameter_items,
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

  const handleParameterItemInputChange = (
    itemIndex: number,
    field: keyof ParameterItemFormData,
    value: string | boolean | string[] | null
  ) => {
    setParameterItemsFormData((prev) => {
      const updated = [...prev];
      updated[itemIndex] = { ...updated[itemIndex]!, [field]: value };
      return updated;
    });
  };

  const handleAddParameterItem = () => {
    const newItem: ParameterItemFormData = {
      name: "",
      description: "",
      value: "",
      isNew: true,
      isDeleted: false,
      defaultItem: false,
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : null,
    };
    setParameterItemsFormData((prev) => [...prev, newItem]);
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
      (item) => !item.isDeleted
    );


    activeItems.forEach((item, index) => {
      if (!item.name.trim()) {
        errors.push(`Parameter item ${index + 1}: Name is required`);
      }
      if (!item.description.trim()) {
        errors.push(`Parameter item ${index + 1}: Description is required`);
      }
      // For numerical parameters, require numeric value
      if (formData?.numerical) {
        if (!item.value.trim()) {
          errors.push(`Parameter item ${index + 1}: Value is required`);
        }
        const numValue = parseFloat(item.value);
        if (isNaN(numValue)) {
          errors.push(
            `Parameter item ${index + 1}: Value must be a valid number`
          );
        }
      }
    });

    return errors;
  };

  // (deprecated) visible items helper removed; we filter inline in the render

  return (
    <div className="space-y-6 py-4 px-4">
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Parameter Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Parameter Name *</Label>
              {formData?.name !== undefined && !isLoading ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Difficulty Level"
                  required
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              {formData?.description !== undefined && !isLoading ? (
                <Textarea
                  id="description"
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
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>


            <div className="flex items-center space-x-2">
              {formData?.numerical !== undefined && !isLoading ? (
                <>
                  <Switch
                    id="numerical"
                    checked={formData.numerical}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, numerical: checked }))
                    }
                  />
                  <Label htmlFor="numerical">Numerical Parameter</Label>
                </>
              ) : (
                <Skeleton className="h-6 w-32" />
              )}
            </div>

            <div className="flex items-center space-x-2">
              {formData?.active !== undefined && !isLoading ? (
                <>
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, active: checked }))
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </>
              ) : (
                <Skeleton className="h-6 w-32" />
              )}
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
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>

            {parameterItemsFormData.some((i) => !i.isDeleted) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Name</TableHead>
                    <TableHead className="w-80">Description</TableHead>
                    {formData?.numerical && (
                      <TableHead className="w-32">Value (Number)</TableHead>
                    )}
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
                                e.target.value
                              )
                            }
                            className="text-sm"
                            placeholder="Item name"
                          />
                        </TableCell>
                        <TableCell className="w-80">
                          <Textarea
                            value={item.description}
                            onChange={(e) =>
                              handleParameterItemInputChange(
                                itemIndex,
                                "description",
                                e.target.value
                              )
                            }
                            className="text-sm min-h-[96px]"
                            rows={4}
                            placeholder="Item description"
                          />
                        </TableCell>
                        {formData?.numerical && (
                          <TableCell className="w-32">
                            <Input
                              type="number"
                              value={item.value}
                              onChange={(e) =>
                                handleParameterItemInputChange(
                                  itemIndex,
                                  "value",
                                  e.target.value
                                )
                              }
                              className="text-sm"
                              placeholder="0"
                            />
                          </TableCell>
                        )}
                        <TableCell className="w-64">
                          <DepartmentPicker
                            mapping={departmentMapping}
                            validIds={validDepartmentIds}
                            selectedIds={item.departmentIds || []}
                            onSelect={(ids) =>
                              handleParameterItemInputChange(
                                itemIndex,
                                "departmentIds",
                                ids.length > 0 ? ids : null
                              )
                            }
                            placeholder="All Departments"
                            multiSelect={true}
                          />
                        </TableCell>
                        <TableCell className="w-20">
                          <div className="flex items-center gap-1">
                            {effectiveProfile?.role === "superadmin" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Checkbox
                                      checked={!!item.defaultItem}
                                      onCheckedChange={(checked) =>
                                        handleParameterItemInputChange(
                                          itemIndex,
                                          "defaultItem",
                                          Boolean(checked)
                                        )
                                      }
                                      aria-label="Save as system item"
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Save as system item
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {item.canDelete !== false && (
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
                    )
                  )}
                </TableBody>
              </Table>
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
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/management/parameters")}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (isEditMode &&
                  JSON.stringify(formData) ===
                    JSON.stringify({
                      name: parameterData?.name,
                      description: parameterData?.description,
                      numerical: parameterData?.numerical,
                      active: parameterData?.active,
                      departmentIds: null,
                    }) &&
                  JSON.stringify(parameterItemsFormData) ===
                    JSON.stringify(
                      (parameterItems || []).map((item) => ({
                        id: item.parameter_item_id,
                        name: item.name,
                        description: item.description,
                        value: item.value,
                        defaultItem: item.default_item ?? false,
                        canDelete: item.can_delete,
                        departmentIds: item.department_ids ?? null,
                        isNew: false,
                        isDeleted: false,
                      }))
                    ))
              }
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
