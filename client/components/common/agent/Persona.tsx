/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/contexts/profile-context";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useDepartments } from "@/contexts/departments-context";
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
import { Bug, Check, ChevronsUpDown, Eye } from "lucide-react";
import UnifiedPromptEditor from "../editor/UnifiedPromptEditor";
import PersonaDebugInfo from "./PersonaDebugInfo";

interface FormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  temperature?: number;
  modelId?: string;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  color?: string;
  icon?: string;
  active?: boolean;
  defaultPersona?: boolean;
  departmentId?: string | null;
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
  const { effectiveDepartmentIds } = useDepartments();
  const isEditMode = mode === "edit" && !!personaId;
  const { effectiveProfile } = useProfile();

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      temperature: 0.0,
      modelId: "",
      reasoning: "none",
      color: "#000000",
      icon: "Zap",
      active: true,
      defaultPersona: false,
      departmentId:
        effectiveProfile?.role === "superadmin"
          ? null
          : effectiveDepartmentIds[0] || null,
    }),
    [effectiveProfile?.role, effectiveDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );

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

  // Extract data from v2 response
  const modelOptions = useMemo(() => {
    if (!personaData?.model_mapping) return [];
    return Object.entries(personaData.model_mapping).map(([id, info]) => ({
      id,
      name: info.name,
    }));
  }, [personaData?.model_mapping]);

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);

  const isLoading = isLoadingData;

  useEffect(() => {
    if (personaData && isEditMode) {
      setFormData({
        name: personaData.name,
        description: personaData.description || "",
        systemPrompt: personaData.system_prompt,
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
        defaultPersona: personaData.default_persona ?? false,
        departmentId: personaData.department_id,
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
      });
    }
  }, [personaData, isEditMode, initialFormData]);

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

    // Department validation for superadmins
    if (effectiveProfile?.role === "superadmin" && !formData.departmentId) {
      toast.error("Department selection is required for superadmin users");
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
            system_prompt: formData.systemPrompt,
            temperature: Number(formData.temperature),
            model_id: formData.modelId,
            reasoning:
              formData.reasoning === "none" ? null : formData.reasoning || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            default_persona: formData.defaultPersona ?? false,
            department_id:
              formData.departmentId || effectiveDepartmentIds[0] || "",
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
            system_prompt: formData.systemPrompt,
            temperature: Number(formData.temperature),
            model_id: formData.modelId,
            reasoning:
              formData.reasoning === "none" ? null : formData.reasoning || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            default_persona: formData.defaultPersona ?? false,
            department_id:
              formData.departmentId || effectiveDepartmentIds[0] || "",
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
                    {personaData?.default_persona
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

            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentId !== undefined && !isLoading ? (
                  <DepartmentPicker
                    mapping={personaData?.department_mapping || {}}
                    validIds={personaData?.valid_department_ids || []}
                    selectedIds={
                      formData?.departmentId ? [formData.departmentId] : []
                    }
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentId: ids[0] || null,
                      }))
                    }
                    placeholder="Select department"
                    disabled={isReadonly}
                    multiSelect={false}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            )}

            {/* Active/Inactive and Default Persona Switches */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
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

              {/* Default Persona Switch - Only for superadmin */}
              {effectiveProfile?.role === "superadmin" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="defaultPersona" className="text-sm">
                    Default Persona
                  </Label>
                  {formData?.defaultPersona !== undefined && !isLoading ? (
                    <Switch
                      id="defaultPersona"
                      checked={formData.defaultPersona ?? false}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          defaultPersona: checked,
                        }))
                      }
                      disabled={isReadonly}
                    />
                  ) : (
                    <Skeleton className="h-6 w-11" />
                  )}
                </div>
              )}
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

            <div className={`grid gap-4 grid-cols-1`}>
              {formData?.modelId !== undefined && !isLoading ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modelId">Text Model *</Label>
                    <Select
                      value={formData?.modelId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          modelId: value,
                        }))
                      }
                      required
                      disabled={isReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            <div className={`grid gap-4 grid-cols-1`}>
              {formData?.reasoning !== undefined && !isLoading ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reasoning">Reasoning Effort</Label>
                    <Select
                      value={formData?.reasoning || "none"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          reasoning: value as
                            | "none"
                            | "minimal"
                            | "low"
                            | "medium"
                            | "high",
                        }))
                      }
                      disabled={isReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reasoning effort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(personaData?.reasoning_options || []).map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <div className="flex gap-2">
                  {formData?.systemPrompt !== undefined && !isLoading && (
                    <>
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
                <div className="h-[500px]">
                  <UnifiedPromptEditor
                    value={formData?.systemPrompt || ""}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        systemPrompt: value,
                      }))
                    }
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
