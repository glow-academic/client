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
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  getPersonaIconComponent,
  PERSONA_ICON_MAP,
} from "@/utils/persona-icons";
import { Check, ChevronsUpDown, FileText, GripVertical, Mic, PlusCircle, Power, Trash2 } from "lucide-react";

// Component for example input with autocomplete
function ExampleInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedExampleIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalExamples,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedExampleIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  totalExamples: number;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on current input value (completing the sentence)
  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];

    const valueLower = value.toLowerCase().trim();

    // Filter suggestions that start with or contain the typed text
    // Exclude exact matches (case-insensitive) to avoid distraction
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches

    return matching;
  }, [suggestions, value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={`flex flex-col gap-2 ${
        draggedExampleIndex === index ? "opacity-50" : ""
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <div
          draggable={!disabled}
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()} // Prevent dragging from input
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {totalExamples > 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface FormData {
  name?: string;
  description?: string;
  instructions?: string;
  simulationType?: "text" | "voice" | "both";
  textAgentId?: string | null;
  voiceAgentId?: string | null;
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
      simulationType: "text",
      textAgentId: null,
      voiceAgentId: null,
      color: "#000000",
      icon: "Zap",
      active: true,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [currentExamples, setCurrentExamples] = useState<string[]>([]);
  const [draggedExampleIndex, setDraggedExampleIndex] = useState<number | null>(null);

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

  // Determine simulation type from agent selection
  const simulationTypeFromAgents = useMemo(() => {
    if (!personaData) return "text";
    const hasText = !!personaData.text_agent_id;
    const hasVoice = !!personaData.voice_agent_id;
    if (hasText && hasVoice) return "both";
    if (hasVoice) return "voice";
    return "text";
  }, [personaData]);

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
        simulationType: simulationTypeFromAgents,
        textAgentId: personaData.text_agent_id || null,
        voiceAgentId: personaData.voice_agent_id || null,
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
        textAgentId:
          personaData.text_agent_id || initialFormData.textAgentId || null,
        instructions:
          personaData.instructions || initialFormData.instructions || "",
        parameterIds: [],
        parameterFieldIds: [],
      });
      setCurrentExamples([]);
    }
  }, [personaData, isEditMode, initialFormData, simulationTypeFromAgents, exampleMapping, getExamplesFromMapping]);

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
    if (formData.simulationType === "text" && !formData.textAgentId) {
      toast.error("Text agent is required for text simulation");
      return;
    }

    if (formData.simulationType === "voice" && !formData.voiceAgentId) {
      toast.error("Voice agent is required for voice simulation");
      return;
    }

    if (formData.simulationType === "both") {
      if (!formData.textAgentId || !formData.voiceAgentId) {
        toast.error(
          "Both text and voice agents are required for combined simulation"
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        personaData?.valid_department_ids || []
      );

      if (isEditMode) {
        updatePersona(
          {
            personaId: personaId!,
            name: formData.name,
            description: formData.description || null,
            instructions: formData.instructions || "",
            text_agent_id: formData.textAgentId || null,
            voice_agent_id: formData.voiceAgentId || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: finalDepartmentIds,
            parameter_ids: formData.parameterIds || [],
            example_ids: [],
            profileId: effectiveProfile?.id || "guest-profile-id",
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
            text_agent_id: formData.textAgentId || null,
            voice_agent_id: formData.voiceAgentId || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: finalDepartmentIds,
            parameter_ids: formData.parameterIds || [],
            example_ids: currentExamples.filter((ex) => ex.trim()),
            profileId: effectiveProfile?.id || "guest-profile-id",
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

  // Dynamic icon component
  const IconComponent = useMemo(() => {
    if (!formData?.icon) return null;
    return getPersonaIconComponent(formData.icon) || null;
  }, [formData?.icon]);

  // Get suggested icons from v2 response
  const _suggestedIcons = useMemo(() => {
    return personaData?.suggested_icons || [];
  }, [personaData?.suggested_icons]);

  // Example handlers
  const addExample = () => {
    if (currentExamples.length >= 10) {
      toast.error("Maximum 10 examples allowed");
      return;
    }
    setCurrentExamples((prev) => [...prev, ""]);
  };

  const removeExample = (index: number) => {
    setCurrentExamples((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExample = (index: number, value: string) => {
    setCurrentExamples((prev) => {
      const newExamples = [...prev];
      newExamples[index] = value;
      return newExamples;
    });
  };

  const handleDragStartExample = (e: React.DragEvent, index: number) => {
    setDraggedExampleIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverExample = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropExample = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedExampleIndex === null) return;
    const newExamples = [...currentExamples];
    const [removed] = newExamples.splice(draggedExampleIndex, 1);
    newExamples.splice(targetIndex, 0, removed || "");
    setCurrentExamples(newExamples);
    setDraggedExampleIndex(null);
  };

  return (
    <TooltipProvider>
      <div
        className="space-y-6 py-4 px-4"
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

        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Persona Name *</Label>
              {formData?.name !== undefined ? (
                <Input
                  id="name"
                  data-testid="input-persona-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Enthusiastic Student"
                  required
                  disabled={isReadonly}
                />
              ) : null}
            </div>

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

            {/* Examples List */}
            <div className="space-y-2">
              <Label>Example Messages</Label>
              {currentExamples.length === 0 && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addExample}
                    disabled={isReadonly}
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Add example
                  </Button>
                </div>
              )}
              {currentExamples.map((example, index) => (
                <ExampleInputWithAutocomplete
                  key={`example-${index}`}
                  index={index}
                  value={example || ""}
                  onChange={(value) => updateExample(index, value)}
                  placeholder={`Example message ${index + 1}`}
                  suggestions={examplesHistory}
                  disabled={isReadonly}
                  draggedExampleIndex={draggedExampleIndex}
                  onDragStart={(e) => handleDragStartExample(e, index)}
                  onDragOver={handleDragOverExample}
                  onDrop={(e) => handleDropExample(e, index)}
                  onRemove={() => removeExample(index)}
                  totalExamples={currentExamples.length}
                />
              ))}

              {currentExamples.length < 10 &&
                currentExamples.length > 0 && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={addExample}
                      disabled={isReadonly}
                      size="sm"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Add example
                    </Button>
                  </div>
                )}
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
                    getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
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

            {/* Color and Icon Selection Row */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Color Picker */}
              <div className="space-y-2">
                <Label htmlFor="color">Persona Color</Label>
                {formData?.color !== undefined ? (
                  <Popover
                    open={colorPickerOpen}
                    onOpenChange={setColorPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={isReadonly}
                        data-testid="button-persona-color"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: formData.color }}
                          />
                          <span>{formData.color}</span>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="colorInput">Hex Color</Label>
                          <div className="flex gap-2">
                            <Input
                              id="colorInput"
                              value={formData.color}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow any hex value (with or without #, any length)
                                if (
                                  value === "" ||
                                  /^#?[0-9A-Fa-f]*$/.test(value)
                                ) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    color: value.startsWith("#")
                                      ? value
                                      : `#${value}`,
                                  }));
                                }
                              }}
                              placeholder="#000000"
                              className="flex-1"
                            />
                            <div
                              className="w-10 h-10 rounded border"
                              style={{ backgroundColor: formData.color }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Preset Colors</Label>
                          <div className="grid grid-cols-8 gap-2">
                            {(personaData?.preset_colors || []).map((color) => (
                              <button
                                key={color}
                                type="button"
                                className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, color }));
                                  setColorPickerOpen(false);
                                }}
                                data-testid="preset-color"
                                data-color={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>

              {/* Icon Picker */}
              <div className="space-y-2">
                <Label htmlFor="icon">Persona Icon</Label>
                {formData?.icon !== undefined ? (
                  <Popover
                    open={iconPickerOpen}
                    onOpenChange={setIconPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={isReadonly}
                        data-testid="button-persona-icon"
                      >
                        <div className="flex items-center gap-2">
                          {IconComponent && (
                            <IconComponent className="w-4 h-4" />
                          )}
                          <span>{formData.icon}</span>
                          <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput placeholder="Search icons..." />
                        <CommandList>
                          <CommandEmpty>No icon found.</CommandEmpty>
                          {_suggestedIcons.length > 0 && (
                            <CommandGroup heading="Suggested for this persona">
                              {_suggestedIcons
                                .slice(0, 6)
                                .map((iconName: string) => {
                                  const IconComponent =
                                    PERSONA_ICON_MAP[
                                      iconName as keyof typeof PERSONA_ICON_MAP
                                    ];
                                  if (!IconComponent) return null;

                                  return (
                                    <CommandItem
                                      key={iconName}
                                      value={iconName}
                                      onSelect={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          icon: iconName,
                                        }));
                                        setIconPickerOpen(false);
                                      }}
                                      data-testid="icon-option"
                                      data-icon={iconName}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.icon === iconName
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <IconComponent className="mr-2 h-4 w-4" />
                                      {iconName}
                                    </CommandItem>
                                  );
                                })}
                            </CommandGroup>
                          )}
                          <CommandGroup heading="All Icons">
                            {(personaData?.valid_icons || []).map(
                              (iconName: string) => {
                                const IconComponent =
                                  PERSONA_ICON_MAP[
                                    iconName as keyof typeof PERSONA_ICON_MAP
                                  ];
                                if (!IconComponent) return null;

                                return (
                                  <CommandItem
                                    key={iconName}
                                    value={iconName}
                                    onSelect={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        icon: iconName,
                                      }));
                                      setIconPickerOpen(false);
                                    }}
                                    data-testid="icon-option"
                                    data-icon={iconName}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.icon === iconName
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <IconComponent className="mr-2 h-4 w-4" />
                                    {iconName}
                                  </CommandItem>
                                );
                              }
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
            </div>

            {/* Simulation Type Selection */}
            <div className="space-y-2">
              <Label>Simulation Type *</Label>
              <RadioGroup
                value={formData?.simulationType || "text"}
                onValueChange={(value) => {
                  const newType = value as "text" | "voice" | "both";
                  setFormData((prev) => {
                    const updated = {
                      ...prev,
                      simulationType: newType,
                    };
                    // Clear agents when switching types
                    if (newType === "text") {
                      updated.voiceAgentId = null;
                    } else if (newType === "voice") {
                      updated.textAgentId = null;
                    }
                    return updated;
                  });
                }}
                className="grid grid-cols-3 gap-3"
              >
                {/* Text Only */}
                <Label
                  className={cn(
                    "cursor-pointer block",
                    "rounded-lg border-2 transition-colors",
                    formData?.simulationType === "text"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="text" className="sr-only" />
                  <div className="flex flex-col items-center justify-center p-4 gap-2">
                    <FileText className="h-6 w-6" />
                    <span className="text-sm font-medium">Text Only</span>
                  </div>
                </Label>

                {/* Voice Only */}
                <Label
                  className={cn(
                    "cursor-pointer block",
                    "rounded-lg border-2 transition-colors",
                    formData?.simulationType === "voice"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="voice" className="sr-only" />
                  <div className="flex flex-col items-center justify-center p-4 gap-2">
                    <Mic className="h-6 w-6" />
                    <span className="text-sm font-medium">Voice Only</span>
                  </div>
                </Label>

                {/* Both */}
                <Label
                  className={cn(
                    "cursor-pointer block",
                    "rounded-lg border-2 transition-colors",
                    formData?.simulationType === "both"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="both" className="sr-only" />
                  <div className="flex flex-col items-center justify-center p-4 gap-2">
                    <div className="flex gap-1">
                      <FileText className="h-6 w-6" />
                      <Mic className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">Both</span>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Agent Selection */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Text Agent */}
              {(formData?.simulationType === "text" ||
                formData?.simulationType === "both") && (
                <div className="space-y-2">
                  <Label htmlFor="textAgentId">Text Agent *</Label>
                  {formData?.textAgentId !== undefined ? (
                    <GenericPicker
                      items={personaData?.agent_mapping || {}}
                      itemIds={
                        personaData?.valid_agent_ids?.filter((id) => {
                          const agent = personaData?.agent_mapping?.[id];
                          return agent?.roles?.includes("simulation-text");
                        }) || []
                      }
                      selectedIds={
                        formData?.textAgentId ? [formData.textAgentId] : []
                      }
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          textAgentId: ids[0] || null,
                        }))
                      }
                      getId={(item) => (item as unknown as { id: string }).id}
                      getLabel={(item) => item.name || ""}
                      getSearchText={(item) => `${item.name} ${item.description || ""}`}
                      renderPreview={(item) => (
                        <div className="grid gap-2">
                          <h4 className="font-medium leading-none">{item.name || "No agent selected"}</h4>
                          <div className="text-sm text-muted-foreground">
                            {item.description || "No description available"}
                          </div>
                        </div>
                      )}
                      renderItem={(item, _isSelected) => (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      placeholder="Select text agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
                  ) : null}
                </div>
              )}

              {/* Voice Agent */}
              {(formData?.simulationType === "voice" ||
                formData?.simulationType === "both") && (
                <div className="space-y-2">
                  <Label htmlFor="voiceAgentId">Voice Agent *</Label>
                  {formData?.voiceAgentId !== undefined ? (
                    <GenericPicker
                      items={personaData?.agent_mapping || {}}
                      itemIds={
                        personaData?.valid_agent_ids?.filter((id) => {
                          const agent = personaData?.agent_mapping?.[id];
                          return agent?.roles?.includes("simulation-voice");
                        }) || []
                      }
                      selectedIds={
                        formData?.voiceAgentId ? [formData.voiceAgentId] : []
                      }
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          voiceAgentId: ids[0] || null,
                        }))
                      }
                      getId={(item) => (item as unknown as { id: string }).id}
                      getLabel={(item) => item.name || ""}
                      getSearchText={(item) => `${item.name} ${item.description || ""}`}
                      renderPreview={(item) => (
                        <div className="grid gap-2">
                          <h4 className="font-medium leading-none">{item.name || "No agent selected"}</h4>
                          <div className="text-sm text-muted-foreground">
                            {item.description || "No description available"}
                          </div>
                        </div>
                      )}
                      renderItem={(item, _isSelected) => (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      placeholder="Select voice agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
                  ) : null}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions *</Label>
              {formData?.instructions !== undefined ? (
                <Textarea
                  id="instructions"
                  data-testid="input-instructions"
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  placeholder="Instructions that define how the persona should behave and respond."
                  rows={8}
                  required
                  disabled={isReadonly}
                />
              ) : null}
              <p className="text-sm text-muted-foreground">
                Instructions define the persona's behavior and personality in
                conversations.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/create/personas")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isReadonly}
                data-testid="btn-submit-persona"
              >
                {isSubmitting
                  ? isEditMode
                    ? "Updating..."
                    : "Creating..."
                  : isEditMode
                    ? "Update Persona"
                    : "Create Persona"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </TooltipProvider>
  );
}
