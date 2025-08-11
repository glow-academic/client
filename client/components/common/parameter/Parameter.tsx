/**
 * Parameter.tsx
 * Used to create and manage parameters - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useProfile } from "@/contexts/profile-context";
import { createParameterItem } from "@/utils/mutations/parameter_items/create-parameter-item";
import { deleteParameterItem } from "@/utils/mutations/parameter_items/delete-parameter-item";
import { updateParameterItem } from "@/utils/mutations/parameter_items/update-parameter-item";
import { createParameter } from "@/utils/mutations/parameters/create-parameter";
import { updateParameter } from "@/utils/mutations/parameters/update-parameter";
import { getParameterItemsByParameter } from "@/utils/queries/parameter_items/get-parameter-items-by-parameter";
import { getParameter } from "@/utils/queries/parameters/get-parameter";
import { Plus, Trash2 } from "lucide-react";

interface FormData {
  name?: string;
  description?: string;
  numerical?: boolean;
  active?: boolean;
  defaultParameter?: boolean;
}

interface ParameterItemFormData {
  id?: string;
  name: string;
  description: string;
  value: string;
  isNew?: boolean;
  isDeleted?: boolean;
  defaultItem?: boolean;
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
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      numerical: false,
      active: false,
      defaultParameter: false,
    }),
    []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [parameterItemsFormData, setParameterItemsFormData] = useState<
    ParameterItemFormData[]
  >([]);

  const { data: parameter, isLoading: isLoadingParameter } = useQuery({
    queryKey: ["parameter", parameterId],
    queryFn: () => getParameter(parameterId!),
    enabled: isEditMode,
  });

  const { data: parameterItems, isLoading: isLoadingParameterItems } = useQuery(
    {
      queryKey: ["parameterItems", parameterId],
      queryFn: () => getParameterItemsByParameter(parameterId!),
      enabled: isEditMode,
    }
  );

  const isLoading = isLoadingParameter || isLoadingParameterItems;

  const [initiallySorted, setInitiallySorted] = useState(false);

  useEffect(() => {
    if (!initiallySorted && parameterItems && parameterItems.length > 0) {
      const sorted = parameterItems
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const formData = sorted.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        value: item.value,
        defaultItem: item.defaultItem ?? false,
        isNew: false,
        isDeleted: false,
      }));
      setParameterItemsFormData(formData);
      setInitiallySorted(true);
    }
  }, [initiallySorted, parameterItems]);

  useEffect(() => {
    if (parameter && isEditMode) {
      setFormData({
        name: parameter.name,
        description: parameter.description,
        numerical: parameter.numerical,
        active: parameter.active,
        defaultParameter: parameter.defaultParameter ?? false,
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [parameter, isEditMode, initialFormData]);

  // After initial sort is applied (or for create mode), update on changes without re-sorting
  useEffect(() => {
    if (mode === "create") {
      return;
    }
    if (!parameterItems) return;
    if (!initiallySorted) return; // wait until initial sort hook runs

    const mapped = parameterItems.sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      value: item.value,
      defaultItem: item.defaultItem ?? false,
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
      if (isEditMode) {
        // Update existing parameter
        await updateParameter(parameterId!, {
          name: formData.name!,
          description: formData.description!,
          numerical: formData.numerical,
          active: formData.active,
          defaultParameter: formData.defaultParameter || false,
          updatedAt: new Date().toISOString(),
        });

        // Handle parameter items
        const promises: Promise<unknown>[] = [];

        parameterItemsFormData.forEach((item) => {
          if (item.isDeleted && item.id) {
            // Delete existing items
            promises.push(deleteParameterItem(item.id));
          } else if (item.isNew && !item.isDeleted) {
            // Create new items
            promises.push(
              createParameterItem({
                name: item.name,
                description: item.description,
                value: formData.numerical ? item.value : item.name,
                parameterId: parameterId!,
                defaultItem: !!item.defaultItem,
              })
            );
          } else if (!item.isNew && !item.isDeleted && item.id) {
            // Update existing items
            promises.push(
              updateParameterItem(item.id, {
                name: item.name,
                description: item.description,
                value: formData.numerical ? item.value : item.name,
                defaultItem: !!item.defaultItem,
                updatedAt: new Date().toISOString(),
              })
            );
          }
        });

        await Promise.all(promises);
        queryClient.invalidateQueries({ queryKey: ["parameters"] });
        queryClient.invalidateQueries({ queryKey: ["parameter", parameterId] });
        queryClient.invalidateQueries({
          queryKey: ["parameterItems", parameterId],
        });
        toast.success("Parameter updated successfully!");
      } else {
        // Create new parameter
        const newParameter = await createParameter({
          name: formData.name!,
          description: formData.description!,
          numerical: formData.numerical || false,
          active: formData.active || false,
          defaultParameter: formData.defaultParameter || false,
        });

        // Create parameter items for the new parameter
        if (newParameter?.id) {
          const promises: Promise<unknown>[] = [];
          parameterItemsFormData.forEach((item) => {
            if (!item.isDeleted) {
              promises.push(
                createParameterItem({
                  name: item.name,
                  description: item.description,
                  value: formData.numerical || false ? item.value : item.name,
                  parameterId: newParameter.id,
                  defaultItem: !!item.defaultItem,
                })
              );
            }
          });

          await Promise.all(promises);
        }

        queryClient.invalidateQueries({ queryKey: ["parameters"] });
        queryClient.invalidateQueries({
          queryKey: ["parameter", newParameter?.id],
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
    value: string | boolean
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
            <h2 className="text-lg font-semibold">Parameter Information</h2>

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

            {effectiveProfile?.role === "superadmin" && (
              <div className="flex items-center space-x-2">
                {formData?.defaultParameter !== undefined && !isLoading ? (
                  <>
                    <Switch
                      id="default-parameter"
                      checked={formData.defaultParameter}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          defaultParameter: checked,
                        }))
                      }
                    />
                    <Label htmlFor="default-parameter">Default Parameter</Label>
                  </>
                ) : (
                  <Skeleton className="h-6 w-40" />
                )}
              </div>
            )}
          </div>

          {/* Parameter Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Parameter Items</h2>
              <Button
                type="button"
                onClick={handleAddParameterItem}
                size="sm"
                variant="outline"
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
                        <TableCell className="w-20">
                          <div className="flex items-center gap-2">
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
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Delete parameter item
                              </TooltipContent>
                            </Tooltip>
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
            <Button type="submit" disabled={isSubmitting}>
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
