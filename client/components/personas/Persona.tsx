/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";

import type {
  CreatePersonaIn,
  CreatePersonaOut,
  PersonaDetailOut,
  PersonaNewOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
} from "@/app/(main)/create/personas/p/[personaId]/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { PersonaColorSection } from "@/components/personas/PersonaColorSection";
import { PersonaIconSection } from "@/components/personas/PersonaIconSection";
import { PersonaContentSection } from "@/components/personas/PersonaContentSection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Check, Loader2, Power } from "lucide-react";

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

interface FormData {
  name?: string;
  description?: string;
  instructions?: string;
  color?: string;
  icon?: string;
  active?: boolean;
  departmentIds?: string[] | null;
  parameterIds?: string[] | null;
  parameterFieldIds?: string[] | null;
}

export interface PersonaProps {
  personaId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  personaDetail?: PersonaDetailOut;
  personaDetailDefault?: PersonaNewOut;
  // Server actions (replaces useMutation)
  createPersonaAction?: (input: CreatePersonaIn) => Promise<CreatePersonaOut>;
  updatePersonaAction?: (input: UpdatePersonaIn) => Promise<UpdatePersonaOut>;
}

export default function Persona({
  personaId,
  mode = personaId ? "edit" : "create",
  personaDetail: serverPersonaDetail,
  personaDetailDefault: serverPersonaDetailDefault,
  createPersonaAction,
  updatePersonaAction,
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!personaId;
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
      instructions: "",
      color: "#000000",
      icon: "Zap",
      active: true,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [currentExamples, setCurrentExamples] = useState<string[]>([]);

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const personaDetail = serverPersonaDetail;
  const personaDetailDefault = serverPersonaDetailDefault;

  // Use edit detail when editing, default detail when creating
  const personaData = isEditMode ? personaDetail : personaDetailDefault;

  // Extract body types for type safety
  type CreatePersonaBody = CreatePersonaIn extends { body: infer B }
    ? B
    : never;
  type UpdatePersonaBody = UpdatePersonaIn extends { body: infer B }
    ? B
    : never;

  // Server action handlers
  const handleCreatePersona = async (body: CreatePersonaBody) => {
    if (!createPersonaAction) {
      throw new Error("createPersonaAction is required");
    }
    await createPersonaAction({ body });
  };

  const handleUpdatePersona = async (body: UpdatePersonaBody) => {
    if (!updatePersonaAction) {
      throw new Error("updatePersonaAction is required");
    }
    await updatePersonaAction({ body });
  };

  // Wrapper functions for compatibility (matching original mutate signature with callbacks)
  const createPersona = (
    body: CreatePersonaBody,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) => {
    handleCreatePersona(body)
      .then(() => {
        options?.onSuccess?.();
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(err);
        if (!options?.onError) {
          toast.error(`Failed to create persona: ${err.message}`);
        }
      });
  };

  const updatePersona = (
    body: UpdatePersonaBody,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) => {
    handleUpdatePersona(body)
      .then(() => {
        options?.onSuccess?.();
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(err);
        if (!options?.onError) {
          toast.error(`Failed to update persona: ${err.message}`);
        }
      });
  };

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);


  // Extract examples from example_mapping
  const exampleMapping = useMemo(() => {
    return (personaData as PersonaDetailOut & { example_mapping?: Record<string, { name: string }> })?.example_mapping || {};
  }, [personaData]);

  // Extract examples from example_ids and example_mapping
  const getExamplesFromMapping = useCallback((exampleIds: string[], mapping: Record<string, { name: string }>): string[] => {
    return exampleIds.map((id) => mapping[id]?.name || "");
  }, []);

  // Filter examples_history based on selected departments
  const examplesHistory = useMemo(() => {
    const rawHistory = (personaData as PersonaDetailOut & { examples_history?: Array<{ example: string; department_ids?: string[] }> })?.examples_history || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // Convert to array of strings for autocomplete
    const examples: string[] = [];

    // If no departments selected, return all examples
    if (selectedDeptIds.length === 0) {
      rawHistory.forEach((ex) => {
        if (typeof ex === "string") {
          examples.push(ex);
        } else if (ex && typeof ex === "object") {
          const exWithDept = ex as {
            example: string;
            department_ids?: string[];
          };
          if ("example" in exWithDept) {
            examples.push(exWithDept.example);
          }
        }
      });
      return examples;
    }

    // Filter examples that:
    // 1. Have department_ids that intersect with selected departments
    // 2. Are cross-department (empty department_ids array)
    rawHistory.forEach((ex) => {
      // Handle both new format (object with department_ids) and legacy format (string)
      if (typeof ex === "string") {
        examples.push(ex); // Legacy format - include all
      } else if (ex && typeof ex === "object") {
        const exWithDept = ex as {
          example: string;
          department_ids?: string[];
        };
        if ("example" in exWithDept) {
          const exDeptIds = exWithDept.department_ids || [];
          // Include if cross-department (empty) or intersects with selected departments
          if (
            exDeptIds.length === 0 ||
            exDeptIds.some((deptId) => selectedDeptIds.includes(deptId))
          ) {
            examples.push(exWithDept.example);
          }
        }
      }
    });

    return examples;
  }, [personaData, formData?.departmentIds]);

  useEffect(() => {
    if (personaData && isEditMode) {
      const deptIds = personaData.department_ids || [];
      const exampleIds = (personaData as PersonaDetailOut & { example_ids?: string[] })?.example_ids || [];
      const examples = getExamplesFromMapping(exampleIds, exampleMapping);
      
      setFormData({
        name: personaData.name,
        description: personaData.description || "",
        instructions: personaData.instructions || "",
        color: personaData.color || "#000000",
        icon: personaData.icon || "Zap",
        active: personaData.active ?? true,
        departmentIds: deptIds,
        parameterIds:
          (
            personaData as PersonaDetailOut & {
              linked_parameter_ids?: string[];
            }
          ).linked_parameter_ids || [],
        parameterFieldIds:
          (personaData as PersonaDetailOut & { parameter_field_ids?: string[] })
            .parameter_field_ids || [],
      });
      setCurrentExamples(examples);
    } else if (!isEditMode && personaData) {
      // For create mode, use defaults from the API response
      setFormData({
        ...initialFormData,
        color: personaData.color || initialFormData.color || "#000000",
        icon: personaData.icon || initialFormData.icon || "Zap",
        instructions:
          personaData.instructions || initialFormData.instructions || "",
        parameterIds: [],
        parameterFieldIds: [],
      });
      setCurrentExamples([]);
    }
  }, [personaData, isEditMode, initialFormData, exampleMapping, getExamplesFromMapping]);

  // Set breadcrumb context when persona data is loaded
  useEffect(() => {
    if (personaDetail?.name && personaId && isEditMode) {
      setEntityMetadata({
        entityId: personaId,
        entityName: personaDetail.name,
        entityType: "persona",
      });
    }
    return () => clearEntityMetadata();
  }, [
    personaDetail,
    personaId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData?.name) {
      toast.error("Persona name is required");
      return;
    }

    if (!formData?.description) {
      toast.error("Persona description is required");
      return;
    }

    if (!formData.instructions) {
      toast.error("Instructions are required");
      return;
    }

    // Validate: at least one agent must be selected based on simulation type
    setIsSubmitting(true);

    try {
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        personaData?.valid_department_ids || []
      );

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      if (isEditMode) {
        updatePersona(
          {
            personaId: personaId!,
            name: formData.name,
            description: formData.description || null,
            instructions: formData.instructions || "",
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: finalDepartmentIds,
            parameter_ids: formData.parameterIds || [],
            example_ids: [],
            profileId: effectiveProfile.id,
          },
          {
            onSuccess: () => {
              toast.success("Persona updated successfully!");
              router.push("/create/personas");
            },
            onError: (error) => {
              toast.error(`Failed to update persona: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        createPersona(
          {
            name: formData.name,
            description: formData.description || null,
            instructions: formData.instructions || "",
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: finalDepartmentIds,
            parameter_ids: formData.parameterIds || [],
            example_ids: currentExamples.filter((ex) => ex.trim()),
            profileId: effectiveProfile.id,
          },
          {
            onSuccess: () => {
              toast.success("Persona created successfully!");
              router.push("/create/personas");
            },
            onError: (error) => {
              toast.error(`Failed to create persona: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} persona: ${error}`
      );
      setIsSubmitting(false);
    }
  };

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();
      const hasDescription = !!formData?.description?.trim();
      const hasColor = !!formData?.color?.trim();
      const hasIcon = !!formData?.icon?.trim();
      const hasInstructions = !!formData?.instructions?.trim();

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "color":
          if (!hasName || !hasDescription) return "pending";
          return hasColor ? "completed" : "active";
        case "icon":
          if (!hasName || !hasDescription) return "pending";
          return hasIcon ? "completed" : "active";
        case "content":
          if (!hasName || !hasDescription) return "pending";
          return hasInstructions ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formData]
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the persona name, description, departments, and active status.",
        status: getStepStatus("basic"),
      },
      {
        id: "color",
        title: "Color",
        description: "Select a color for the persona.",
        status: getStepStatus("color"),
      },
      {
        id: "icon",
        title: "Icon",
        description: "Select an icon for the persona.",
        status: getStepStatus("icon"),
      },
      {
        id: "content",
        title: "Personality",
        description: "Define instructions and example messages for the persona.",
        status: getStepStatus("content"),
      },
    ];
  }, [getStepStatus]);

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`persona-${isEditMode ? "edit" : "new"}`}
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
                  Persona is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {personaData?.department_ids?.length === 0
                      ? "This is a default persona that cannot be edited. You can view the details but cannot make changes."
                      : "This persona is currently in use by scenarios and cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic Information */}
          <Card className="transition-all">
            <CardContent className="pt-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                    steps[0]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[0]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[0]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>1</span>
                  )}
                </div>
                <div className="flex-1">
              {formData?.name !== undefined ? (
                    <input
                      type="text"
                  id="name"
                  data-testid="input-persona-name"
                  value={formData.name}
                  onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                  }
                      className={cn(
                        "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                      )}
                  placeholder="e.g., Enthusiastic Student"
                  required
                  disabled={isReadonly}
                />
              ) : null}
                  <p className="text-xs text-muted-foreground mt-1 px-2">
                    {formData?.name === "" || !formData?.name
                      ? "Click to edit • Name is required"
                      : "Click to edit"}
                  </p>
            </div>
              </div>
            </CardContent>
            <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-persona-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                  required
                  disabled={isReadonly}
                />
              ) : null}
            </div>

            {/* Department Selection */}
            {personaData?.valid_department_ids &&
            personaData.valid_department_ids.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <GenericPicker
                    items={personaData?.department_mapping || {}}
                    itemIds={personaData?.valid_department_ids || []}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentIds: ids,
                      }))
                    }
                    getId={(dept) => (dept as unknown as { id: string }).id}
                    getLabel={(dept) => dept.name || ""}
                      getSearchText={(dept) =>
                        `${dept.name} ${dept.description || ""}`
                      }
                    placeholder="All Departments"
                    disabled={isReadonly}
                    multiSelect={true}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                  />
                ) : null}
              </div>
            ) : null}

            {/* Required Parameters */}
            {personaData &&
            (
              personaData as PersonaDetailOut & {
                linked_parameter_ids?: string[];
              }
            ).linked_parameter_ids &&
            (
              personaData as PersonaDetailOut & {
                linked_parameter_ids?: string[];
              }
            ).linked_parameter_ids!.length > 0 ? (
              <div className="space-y-4">
                <Label>Required Parameters</Label>
                {formData?.parameterFieldIds !== undefined ? (
                  <ParameterSelector
                    parameterMapping={
                      (
                        personaData as PersonaDetailOut & {
                          parameter_mapping?: Record<
                            string,
                            {
                              name: string;
                              description: string;
                              numerical: boolean;
                              document_parameter: boolean;
                              persona_parameter: boolean;
                            }
                          >;
                        }
                      ).parameter_mapping || {}
                    }
                    fieldMapping={
                      (
                        personaData as PersonaDetailOut & {
                          field_mapping?: Record<
                            string,
                            {
                              name: string;
                              description: string;
                              parameter_id: string;
                              parameter_name: string;
                              value: string;
                            }
                          >;
                        }
                      ).field_mapping || {}
                    }
                    validParameterItemIds={
                      (
                        personaData as PersonaDetailOut & {
                          valid_parameter_item_ids?: string[];
                        }
                      ).valid_parameter_item_ids || []
                    }
                    selectedParameterItemIds={formData.parameterFieldIds || []}
                    onParameterItemIdsChange={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        parameterFieldIds: ids,
                      }))
                    }
                    disabled={isReadonly}
                  />
                ) : null}
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
                  {formData?.active !== undefined ? (
                    <Switch
                      id="active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          active: checked,
                        }))
                      }
                      disabled={isReadonly}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive personas will not be available for scenarios
                </p>
              </div>
            </div>
            </CardContent>
          </Card>

          {/* Step 2: Color */}
          {formData?.color !== undefined && (
            <PersonaColorSection
              color={formData.color}
              presetColors={personaData?.preset_colors || []}
              onColorChange={(color) =>
                setFormData((prev) => ({ ...prev, color }))
              }
              stepStatus={getStepStatus("color")}
              stepNumber={2}
              stepTitle={steps[1]?.title || "Color"}
              stepDescription={steps[1]?.description || "Select a color for the persona."}
              isReadonly={isReadonly}
            />
          )}

          {/* Step 3: Icon */}
          {formData?.icon !== undefined && (
            <PersonaIconSection
              icon={formData.icon}
              suggestedIcons={personaData?.suggested_icons || []}
              validIcons={personaData?.valid_icons || []}
              onIconChange={(icon) =>
                setFormData((prev) => ({ ...prev, icon }))
              }
              stepStatus={getStepStatus("icon")}
              stepNumber={3}
              stepTitle={steps[2]?.title || "Icon"}
              stepDescription={steps[2]?.description || "Select an icon for the persona."}
              isReadonly={isReadonly}
            />
          )}

          {/* Step 4: Personality */}
          {formData?.instructions !== undefined && (
            <PersonaContentSection
              instructions={formData.instructions}
              onInstructionsChange={(instructions) =>
                setFormData((prev) => ({ ...prev, instructions }))
              }
              exampleMessages={currentExamples}
              onExampleMessagesChange={setCurrentExamples}
              examplesHistory={examplesHistory}
              stepStatus={getStepStatus("content")}
              stepNumber={4}
              stepTitle={steps[3]?.title || "Personality"}
              stepDescription={steps[3]?.description || "Define instructions and example messages for the persona."}
              isReadonly={isReadonly}
            />
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/create/personas")}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isReadonly}
              data-testid="btn-submit-persona"
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : isEditMode ? (
                "Update Persona"
              ) : (
                "Create Persona"
              )}
            </Button>
          </div>
        </form>
      </div>
    </TooltipProvider>
  );
}
