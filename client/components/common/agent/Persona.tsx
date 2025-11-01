/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ModelPicker } from "@/components/common/forms/ModelPicker";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { ReasoningPicker } from "@/components/common/forms/ReasoningPicker";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCreatePersona as useCreatePersonaV2,
  usePersonaDetail,
  usePersonaDetailDefault,
  useUpdatePersona as useUpdatePersonaV2,
} from "@/lib/api/v2/hooks/personas";
// import { useScenariosByDepartmentIdBatch } from "@/lib/api/hooks/scenarios";
import { cn } from "@/lib/utils";
import {
  getPersonaIconComponent,
  PERSONA_ICON_MAP,
} from "@/utils/persona-icons";
import { Bug, Check, ChevronsUpDown, Copy, Eye } from "lucide-react";
import UnifiedPromptEditor from "../editor/UnifiedPromptEditor";
import PersonaDebugInfo from "./PersonaDebugInfo";

interface FormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  promptId?: string | null;
  temperature?: number;
  modelId?: string;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  color?: string;
  icon?: string;
  active?: boolean;
  departmentIds?: string[] | null;
}

export interface PersonaProps {
  personaId?: string;
  mode?: "create" | "edit";
}

export default function Persona({
  personaId,
  mode = personaId ? "edit" : "create",
}: PersonaProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!personaId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      promptId: null,
      temperature: 0.0,
      modelId: "",
      reasoning: "none",
      color: "#000000",
      icon: "Zap",
      active: true,
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : [],
    }),
    [effectiveProfile?.primaryDepartmentId]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(null); // null = "All Departments"
  const [isCreatingNewPrompt, setIsCreatingNewPrompt] = useState(false);
  const prevDepartmentIdRef = React.useRef<string | null>(null);

  // V2 API hooks
  const { data: personaDetail, isLoading: isLoadingPersonaDetail } =
    usePersonaDetail(
      personaId || "",
      effectiveProfile?.id || "",
      !!personaId && isEditMode
    );

  const { data: personaDetailDefault, isLoading: isLoadingPersonaDefault } =
    usePersonaDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const personaData = isEditMode ? personaDetail : personaDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingPersonaDetail
    : isLoadingPersonaDefault;

  const { mutate: createPersona } = useCreatePersonaV2();
  const { mutate: updatePersona } = useUpdatePersonaV2();

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);

  const isLoading = isLoadingData;

  // Filter prompt_mapping based on selected department
  // When "All Departments" is selected, only show default prompts (null department_ids)
  // When a department is selected, only show department-specific prompts for that department
  const filteredPromptMapping = useMemo(() => {
    if (!isEditMode || !personaData?.prompt_mapping) {
      return personaData?.prompt_mapping || {};
    }

    const filtered: Record<string, PromptInfo> = {};
    for (const [promptId, promptInfo] of Object.entries(
      personaData.prompt_mapping
    )) {
      if (!selectedDepartmentId) {
        // "All Departments" selected - only show default prompts (null/empty department_ids)
        if (
          !promptInfo.department_ids ||
          promptInfo.department_ids.length === 0
        ) {
          filtered[promptId] = promptInfo;
        }
      } else {
        // Department selected - only show department-specific prompts for that department
        if (
          promptInfo.department_ids &&
          promptInfo.department_ids.includes(selectedDepartmentId)
        ) {
          filtered[promptId] = promptInfo;
        }
      }
    }
    return filtered;
  }, [selectedDepartmentId, personaData?.prompt_mapping, isEditMode]);

  // Detect if using default prompt (no department-specific prompt exists)
  const isUsingDefaultPrompt = useMemo(() => {
    if (!isEditMode || !selectedDepartmentId || !personaData) return false;
    return !personaData.department_prompt_links?.[selectedDepartmentId];
  }, [selectedDepartmentId, personaData, isEditMode]);

  // Get default prompt content
  const defaultPromptContent = useMemo(() => {
    if (!isEditMode || !personaData?.prompt_id || !personaData?.prompt_mapping)
      return "";
    const defaultPrompt = personaData.prompt_mapping[personaData.prompt_id];
    return defaultPrompt?.system_prompt || "";
  }, [personaData, isEditMode]);

  useEffect(() => {
    if (personaData && isEditMode) {
      setFormData({
        name: personaData.name,
        description: personaData.description || "",
        systemPrompt: personaData.system_prompt,
        promptId: personaData.prompt_id || null,
        temperature: personaData.temperature,
        modelId: personaData.model_id || "",
        reasoning:
          (personaData.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
        color: personaData.color || "#000000",
        icon: personaData.icon || "Zap",
        active: personaData.active ?? true,
        departmentIds: personaData.department_ids,
      });
    } else if (!isEditMode && personaData) {
      // For create mode, use defaults from the API response
      setFormData({
        ...initialFormData,
        color: personaData.color || initialFormData.color || "#000000",
        icon: personaData.icon || initialFormData.icon || "Zap",
        temperature:
          personaData.temperature ?? initialFormData.temperature ?? 0.0,
        modelId: personaData.model_id || initialFormData.modelId || "",
        systemPrompt:
          personaData.system_prompt || initialFormData.systemPrompt || "",
        promptId: null,
      });
    }
  }, [personaData, isEditMode, initialFormData]);

  // Update prompt when department selection changes
  useEffect(() => {
    if (!isEditMode || !personaData) return;

    // Track department changes FIRST and reset creating flag when department changes
    const departmentChanged =
      prevDepartmentIdRef.current !== selectedDepartmentId;
    if (departmentChanged) {
      setIsCreatingNewPrompt(false);
      prevDepartmentIdRef.current = selectedDepartmentId;
    }

    // Don't override state if user is actively creating a new prompt (unless department changed)
    if (isCreatingNewPrompt && !departmentChanged) return;

    // Determine which prompt should be selected for the current department
    const getCurrentPromptId = () => {
      if (!selectedDepartmentId) {
        // "All Departments" selected - use default prompt
        return personaData.prompt_id || null;
      }
      // Specific department selected - use department-specific prompt if it exists
      if (personaData.department_prompt_links?.[selectedDepartmentId]) {
        return personaData.department_prompt_links[selectedDepartmentId];
      }
      // No department-specific prompt - return null to indicate using default
      return null;
    };

    const currentPromptId = getCurrentPromptId();
    const promptInfo =
      currentPromptId && personaData.prompt_mapping?.[currentPromptId];

    // Check if current formData.promptId is valid for the selected department
    const currentPromptIsValid = formData?.promptId
      ? filteredPromptMapping[formData.promptId] !== undefined
      : true; // null promptId is valid (means using default)

    // Only auto-select when department changes, or if current prompt is invalid for department
    if (departmentChanged) {
      // Department changed - always update to the correct prompt
      if (promptInfo) {
        // Prompt exists (default or department-specific) - select it and update system prompt
        setFormData((prev) => ({
          ...prev,
          promptId: currentPromptId,
          systemPrompt: promptInfo.system_prompt,
        }));
      } else if (selectedDepartmentId && !currentPromptId) {
        // Department selected but no department-specific prompt - using default
        setFormData((prev) => ({
          ...prev,
          promptId: null,
          systemPrompt: "", // Clear to show default prompt UI
        }));
      } else {
        // "All Departments" selected but no default prompt, or other edge case
        setFormData((prev) => ({
          ...prev,
          promptId: null,
        }));
      }
    } else if (!currentPromptIsValid && formData?.promptId) {
      // Current prompt is invalid for selected department - reset to default
      if (promptInfo) {
        setFormData((prev) => ({
          ...prev,
          promptId: currentPromptId,
          systemPrompt: promptInfo.system_prompt,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          promptId: null,
          systemPrompt: "",
        }));
      }
    }
  }, [
    selectedDepartmentId,
    personaData,
    isEditMode,
    formData?.promptId,
    isCreatingNewPrompt,
    filteredPromptMapping,
  ]);

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

    if (!formData.systemPrompt) {
      toast.error("System prompt is required");
      return;
    }

    if (!formData.modelId || formData.modelId === "") {
      // must have some model selected
      toast.error("Model selection is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        updatePersona(
          {
            personaId: personaId!,
            name: formData.name,
            description: formData.description || null,
            prompt_id: formData.promptId || null,
            system_prompt: formData.systemPrompt,
            temperature: Number(formData.temperature),
            model_id: formData.modelId,
            reasoning:
              formData.reasoning === "none" ? null : formData.reasoning || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: formData.departmentIds || null,
            department_id: selectedDepartmentId || null,
            department_prompt_id:
              selectedDepartmentId && formData.promptId
                ? formData.promptId
                : null,
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
            prompt_id: formData.promptId || null,
            system_prompt: formData.systemPrompt,
            temperature: Number(formData.temperature),
            model_id: formData.modelId,
            reasoning:
              formData.reasoning === "none" ? null : formData.reasoning || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: formData.departmentIds || null,
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

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4">
        {isReadonly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
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
                <h3 className="text-sm font-medium text-yellow-800">
                  Persona is read-only
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
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
              {formData?.name !== undefined && !isLoading ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Enthusiastic Student"
                  required
                  disabled={isReadonly}
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
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                  required
                  disabled={isReadonly}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {formData?.departmentIds !== undefined && !isLoading ? (
                <DepartmentPicker
                  mapping={personaData?.department_mapping || {}}
                  validIds={personaData?.valid_department_ids || []}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      departmentIds: ids,
                    }))
                  }
                  placeholder="All Departments"
                  disabled={isReadonly}
                  multiSelect={true}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            {/* Switches - Horizontal Layout */}
            <div className="flex gap-8">
              {/* Persona Active Switch */}
              <div className="flex items-center gap-2">
                <Label htmlFor="active" className="text-sm">
                  Persona Active
                </Label>
                {formData?.active !== undefined && !isLoading ? (
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
                ) : (
                  <Skeleton className="h-6 w-11" />
                )}
              </div>
            </div>

            {/* Color and Icon Selection Row */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {/* Color Picker */}
              <div className="space-y-2">
                <Label htmlFor="color">Persona Color</Label>
                {formData?.color !== undefined && !isLoading ? (
                  <Popover
                    open={colorPickerOpen}
                    onOpenChange={setColorPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={isReadonly}
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
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Icon Picker */}
              <div className="space-y-2">
                <Label htmlFor="icon">Persona Icon</Label>
                {formData?.icon !== undefined && !isLoading ? (
                  <Popover
                    open={iconPickerOpen}
                    onOpenChange={setIconPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={isReadonly}
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
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            {/* Text Model, Reasoning Effort, and Temperature - 3 Column Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Text Model */}
              <div className="space-y-2">
                <Label htmlFor="modelId">Text Model *</Label>
                {formData?.modelId !== undefined && !isLoading ? (
                  <ModelPicker
                    mapping={personaData?.model_mapping || {}}
                    validIds={personaData?.valid_model_ids || []}
                    selectedIds={formData?.modelId ? [formData.modelId] : []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        modelId: ids[0] || "",
                      }))
                    }
                    placeholder="Select a model"
                    disabled={isReadonly}
                    multiSelect={false}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Reasoning Effort */}
              <div className="space-y-2">
                <Label htmlFor="reasoning">Reasoning Effort</Label>
                {formData?.reasoning !== undefined && !isLoading ? (
                  <ReasoningPicker
                    mapping={personaData?.reasoning_mapping || {}}
                    validIds={["none", "minimal", "low", "medium", "high"]}
                    selectedIds={
                      formData?.reasoning ? [formData.reasoning] : ["none"]
                    }
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        reasoning: (ids[0] || "none") as
                          | "none"
                          | "minimal"
                          | "low"
                          | "medium"
                          | "high",
                      }))
                    }
                    placeholder="Select reasoning effort"
                    disabled={isReadonly}
                    multiSelect={false}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature:{" "}
                  {formData?.temperature !== undefined
                    ? formData.temperature.toFixed(2)
                    : "0.00"}
                </Label>
                {formData?.temperature !== undefined && !isLoading ? (
                  <>
                    <Slider
                      id="temperature"
                      data-testid="temperature-slider"
                      min={personaData?.temperature_lower ?? 0}
                      max={personaData?.temperature_upper ?? 1}
                      step={0.01}
                      value={[formData?.temperature || 0]}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          temperature: value[0] || 0,
                        }))
                      }
                      className="w-full"
                      disabled={isReadonly}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Deterministic</span>
                      <span>Creative</span>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <div className="flex gap-2">
                  {isEditMode && personaData && (
                    <DepartmentPicker
                      mapping={personaData.department_mapping}
                      validIds={personaData.valid_department_ids}
                      selectedIds={
                        selectedDepartmentId ? [selectedDepartmentId] : []
                      }
                      onSelect={(ids) => {
                        setSelectedDepartmentId(
                          ids.length > 0 ? ids[0]! : null
                        );
                      }}
                      multiSelect={false}
                      placeholder="All Departments"
                      disabled={isReadonly}
                      compact={true}
                      buttonClassName="h-8"
                    />
                  )}
                  {isEditMode &&
                    personaData &&
                    filteredPromptMapping &&
                    (Object.keys(filteredPromptMapping).length > 0 ||
                      selectedDepartmentId) && (
                      <PromptPicker
                        promptMapping={filteredPromptMapping}
                        selectedPromptId={formData?.promptId || null}
                        onSelect={(promptId) => {
                          if (promptId && filteredPromptMapping[promptId]) {
                            const prompt = filteredPromptMapping[promptId];
                            setFormData((prev) => ({
                              ...prev,
                              promptId: promptId,
                              systemPrompt: prompt.system_prompt,
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              promptId: null,
                            }));
                          }
                        }}
                        onCreateNew={() => {
                          setIsCreatingNewPrompt(true);
                          // When creating new, always start with empty prompt
                          // (Use "Branch from Default" button if you want to start with default content)
                          setFormData((prev) => ({
                            ...prev,
                            promptId: null,
                            systemPrompt: "",
                          }));
                        }}
                        placeholder="Select prompt version..."
                        disabled={isReadonly}
                        buttonClassName="h-8"
                      />
                    )}
                  {formData?.systemPrompt !== undefined && !isLoading && (
                    <>
                      {isEditMode &&
                        (formData?.promptId || isUsingDefaultPrompt) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setIsCreatingNewPrompt(true);
                                  // Duplicate current prompt - keep content but create new prompt
                                  // If using default prompt, duplicate default content
                                  // If All Departments selected, duplicate current prompt content
                                  const contentToDuplicate =
                                    isUsingDefaultPrompt
                                      ? defaultPromptContent
                                      : formData?.systemPrompt || "";
                                  setFormData((prev) => ({
                                    ...prev,
                                    promptId: null,
                                    systemPrompt: contentToDuplicate,
                                  }));
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isUsingDefaultPrompt
                                  ? "Branch from Default Prompt"
                                  : "Duplicate Prompt"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={
                              editorMode === "preview" ? "default" : "secondary"
                            }
                            size="sm"
                            onClick={() =>
                              setEditorMode(
                                editorMode === "preview" ? "editor" : "preview"
                              )
                            }
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Preview</p>
                        </TooltipContent>
                      </Tooltip>
                      {isEditMode &&
                        effectiveProfile?.role === "superadmin" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={
                                  editorMode === "debug"
                                    ? "default"
                                    : "secondary"
                                }
                                size="sm"
                                onClick={() =>
                                  setEditorMode(
                                    editorMode === "debug" ? "editor" : "debug"
                                  )
                                }
                                className="h-8 w-8 p-0"
                              >
                                <Bug className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Debug</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                    </>
                  )}
                </div>
              </div>
              {formData?.systemPrompt !== undefined && !isLoading ? (
                <>
                  {isUsingDefaultPrompt &&
                  formData.systemPrompt === "" &&
                  !isCreatingNewPrompt ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-6 bg-muted/50">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <p className="text-sm font-medium">
                              Using Default Prompt
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedDepartmentId &&
                            personaData?.department_mapping?.[
                              selectedDepartmentId
                            ]
                              ? `No department-specific prompt exists for ${personaData.department_mapping[selectedDepartmentId].name}. The default prompt is being used.`
                              : "No department-specific prompt exists. The default prompt is being used."}
                          </p>
                          <div className="border-t pt-4 mt-4">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">
                              Default Prompt Preview:
                            </p>
                            <div className="bg-background border rounded p-4 max-h-[200px] overflow-y-auto">
                              <pre className="text-xs whitespace-pre-wrap font-mono">
                                {defaultPromptContent || "No default prompt"}
                              </pre>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewPrompt(true);
                                setFormData((prev) => ({
                                  ...prev,
                                  promptId: null,
                                  systemPrompt: "",
                                }));
                              }}
                              disabled={isReadonly}
                            >
                              Create New Prompt
                              {selectedDepartmentId &&
                              personaData?.department_mapping?.[
                                selectedDepartmentId
                              ]
                                ? ` for ${personaData.department_mapping[selectedDepartmentId].name}`
                                : ""}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewPrompt(true);
                                setFormData((prev) => ({
                                  ...prev,
                                  promptId: null,
                                  systemPrompt: defaultPromptContent,
                                }));
                              }}
                              disabled={isReadonly}
                            >
                              Branch from Default
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[500px]">
                      <UnifiedPromptEditor
                        value={formData?.systemPrompt || ""}
                        onChange={(value) => {
                          setIsCreatingNewPrompt(true); // User is actively editing
                          setFormData((prev) => ({
                            ...prev,
                            systemPrompt: value,
                            promptId: null, // Clear promptId when editing, indicating new prompt
                          }));
                        }}
                        placeholder="System prompt that defines how the persona should behave and respond. You can use markdown formatting."
                        disabled={isReadonly}
                        className="h-full"
                        debugContent={
                          isEditMode &&
                          personaData &&
                          effectiveProfile?.role === "superadmin" ? (
                            <PersonaDebugInfo
                              debugInfo={personaData.debug_info}
                              modelMapping={personaData.model_mapping}
                            />
                          ) : undefined
                        }
                        activeMode={editorMode}
                      />
                    </div>
                  )}
                </>
              ) : (
                <Skeleton className="h-[500px] w-full" />
              )}
              <p className="text-sm text-muted-foreground">
                This prompt defines the persona's behavior and personality in
                conversations. You can use markdown formatting for better
                organization.
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
              <Button type="submit" disabled={isSubmitting || isReadonly}>
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
