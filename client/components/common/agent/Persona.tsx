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
import { cn } from "@/lib/utils";
import {
  getPersonaIconComponent,
  getSuggestedIconsForPersona,
  PERSONA_ICON_MAP,
  PERSONA_ICONS,
} from "@/utils/persona-icons";
import { Check, ChevronsUpDown } from "lucide-react";
import MarkdownEditor from "../viewers/MarkdownEditor";
import PersonaDebugInfo from "./PersonaDebugInfo";
import {
  useCreatePersona,
  usePersona,
  useUpdatePersona,
} from "@/lib/api/hooks/personas";
import { useModels } from "@/lib/api/hooks/models";
import { useScenarios } from "@/lib/api/hooks/scenarios";

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
  guardrailActive?: boolean;
  imageInputActive?: boolean;
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
      guardrailActive: false,
      imageInputActive: false,
    }),
    [],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const { data: persona, isLoading: isLoadingPersona } = usePersona(personaId!);

  const { data: models, isLoading: isModelsLoading } = useModels();

  const { data: scenarios = [] } = useScenarios();

  const { mutate: createPersona } = useCreatePersona();
  const { mutate: updatePersona } = useUpdatePersona();

  // Readonly rules: default persona editable only by superadmin; otherwise admin/superadmin can edit; others read-only if in use
  const isReadonly = useMemo(() => {
    if (!isEditMode || !persona) return false;

    const isSuperAdmin = effectiveProfile?.role === "superadmin";
    const isAdmin = effectiveProfile?.role === "admin" || isSuperAdmin;
    const isDefaultPersona = persona.defaultPersona;

    if (isDefaultPersona && !isSuperAdmin) {
      return true;
    }

    const inUse = scenarios.some(
      (scenario) => scenario.personaId === persona.id,
    );
    if (!isAdmin && inUse) {
      return true;
    }

    return false;
  }, [isEditMode, persona, effectiveProfile?.role, scenarios]);

  const isLoading = isLoadingPersona || isModelsLoading;

  useEffect(() => {
    if (persona && isEditMode) {
      setFormData({
        name: persona.name,
        description: persona.description,
        systemPrompt: persona.systemPrompt,
        temperature: persona.temperature,
        modelId: persona.modelId || "",
        reasoning:
          (persona.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
        color: persona.color || "#000000",
        icon: persona.icon || "Zap",
        active: persona.active ?? true,
        defaultPersona: persona.defaultPersona ?? false,
        guardrailActive: persona.guardrailActive ?? false,
        imageInputActive: persona.imageInputActive ?? false,
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [persona, isEditMode, initialFormData]);

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
        await updatePersona({
          id: personaId!,
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
          reasoning: formData.reasoning === "none" ? null : formData.reasoning,
          color: formData.color || "#000000",
          icon: formData.icon || "Zap",
          active: formData.active ?? true,
          defaultPersona: formData.defaultPersona ?? false,
          guardrailActive: formData.guardrailActive ?? false,
          imageInputActive: formData.imageInputActive ?? false,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Persona updated successfully!");
      } else {
        await createPersona({
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
          reasoning: formData.reasoning === "none" ? null : formData.reasoning,
          color: formData.color || "#000000",
          icon: formData.icon || "Zap",
          active: formData.active ?? true,
          defaultPersona: formData.defaultPersona ?? false,
          guardrailActive: formData.guardrailActive ?? false,
          imageInputActive: formData.imageInputActive ?? false,
        });
        toast.success("Persona created successfully!");
      }

      router.push("/create/personas");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} persona: ${error}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic icon component
  const IconComponent = useMemo(() => {
    if (!formData?.icon) return null;
    return getPersonaIconComponent(formData.icon) || null;
  }, [formData?.icon]);

  // Get suggested icons when persona name changes
  const _suggestedIcons = useMemo(() => {
    if (!formData?.name) return [];
    return getSuggestedIconsForPersona(formData.name);
  }, [formData?.name]);

  return (
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
                  {persona?.defaultPersona
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
                onChange={(e) => {
                  const newName = e.target.value;
                  setFormData((prev) => {
                    const updatedData = { ...prev, name: newName };

                    // Auto-suggest icon if no icon is selected yet or if it's the default
                    if (!prev?.icon || prev.icon === "Zap") {
                      const suggestions = getSuggestedIconsForPersona(newName);
                      if (suggestions.length > 0) {
                        updatedData.icon = suggestions[0] || "Zap";
                      }
                    }

                    return updatedData;
                  });
                }}
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

            {/* Guardrail Active Switch - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="guardrailActive" className="text-sm">
                  Guardrail Active
                </Label>
                {formData?.guardrailActive !== undefined && !isLoading ? (
                  <Switch
                    id="guardrailActive"
                    checked={formData.guardrailActive ?? false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        guardrailActive: checked,
                      }))
                    }
                    disabled={isReadonly}
                  />
                ) : (
                  <Skeleton className="h-6 w-11" />
                )}
              </div>
            )}

            {/* Image Input Active Switch - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="imageInputActive" className="text-sm">
                  Image Input Active
                </Label>
                {formData?.imageInputActive !== undefined && !isLoading ? (
                  <Switch
                    id="imageInputActive"
                    checked={formData.imageInputActive ?? false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        imageInputActive: checked,
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
                          {[
                            "#ef4444",
                            "#f97316",
                            "#eab308",
                            "#22c55e",
                            "#06b6d4",
                            "#3b82f6",
                            "#8b5cf6",
                            "#ec4899",
                            "#dc2626",
                            "#ea580c",
                            "#ca8a04",
                            "#16a34a",
                            "#0891b2",
                            "#2563eb",
                            "#7c3aed",
                            "#db2777",
                            "#b91c1c",
                            "#c2410c",
                            "#a16207",
                            "#15803d",
                            "#0e7490",
                            "#1d4ed8",
                            "#6d28d9",
                            "#be185d",
                            "#991b1b",
                            "#9a3412",
                            "#854d0e",
                            "#166534",
                            "#155e75",
                            "#1e40af",
                            "#581c87",
                            "#9d174d",
                          ].map((color) => (
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
                <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={isReadonly}
                    >
                      <div className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="w-4 h-4" />}
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
                                          : "opacity-0",
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
                          {PERSONA_ICONS.map((iconName: string) => {
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
                                      : "opacity-0",
                                  )}
                                />
                                <IconComponent className="mr-2 h-4 w-4" />
                                {iconName}
                              </CommandItem>
                            );
                          })}
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
                      {models
                        ?.filter((model) => model.active)
                        ?.map((model) => (
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
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
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
                  min={0}
                  max={1}
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
            <Label htmlFor="systemPrompt">System Prompt *</Label>
            {formData?.systemPrompt !== undefined && !isLoading ? (
              <>
                <div className="h-[500px] overflow-auto">
                  <MarkdownEditor
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
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This prompt defines the persona's behavior and personality in
                  conversations. You can use markdown formatting for better
                  organization.
                </p>
              </>
            ) : (
              <Skeleton className="h-100 w-full" />
            )}
          </div>

          {/* Debug Info Section - Only for superadmin and edit mode */}
          {isEditMode && effectiveProfile?.role === "superadmin" && (
            <div className="space-y-2">
              <Label>Debug Info</Label>
              <PersonaDebugInfo personaId={personaId!} />
            </div>
          )}

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
  );
}
