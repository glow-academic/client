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

import type {
  CreatePersonaIn,
  CreatePersonaOut,
  PersonaDetailOut,
  PersonaNewOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
} from "@/app/(main)/create/personas/p/[personaId]/page";
import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
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
import { Check, ChevronsUpDown, FileText, Mic, Power } from "lucide-react";

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

  useEffect(() => {
    if (personaData && isEditMode) {
      const deptIds = personaData.department_ids || [];
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
    }
  }, [personaData, isEditMode, initialFormData, simulationTypeFromAgents]);

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

            {/* Department Selection */}
            {personaData?.valid_department_ids &&
            personaData.valid_department_ids.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
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
                    triggerProps={{ "data-testid": "picker-department" }}
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
                    parameterItemMapping={
                      (
                        personaData as PersonaDetailOut & {
                          parameter_item_mapping?: Record<
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
                      ).parameter_item_mapping || {}
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
                    <AgentPicker
                      mapping={personaData?.agent_mapping || {}}
                      validIds={
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
                      placeholder="Select text agent"
                      disabled={isReadonly}
                      multiSelect={false}
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
                    <AgentPicker
                      mapping={personaData?.agent_mapping || {}}
                      validIds={
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
                      placeholder="Select voice agent"
                      disabled={isReadonly}
                      multiSelect={false}
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
