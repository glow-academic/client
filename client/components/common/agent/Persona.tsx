/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPersona } from "@/utils/mutations/personas/create-persona";
import { updatePersona } from "@/utils/mutations/personas/update-persona";
import {
  getPersonaIconComponent,
  getSuggestedIconsForPersona,
  PERSONA_ICON_MAP,
  PERSONA_ICONS,
} from "@/utils/persona-icons";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { getPersona } from "@/utils/queries/personas/get-persona";
import { Check, ChevronsUpDown } from "lucide-react";

interface FormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  temperature?: number;
  modelId?: string;
  reasoning?: "none" | "low" | "medium" | "high";
  color?: string;
  icon?: string;
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
  const queryClient = useQueryClient();

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
    }),
    []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const { data: persona, isLoading: isLoadingPersona } = useQuery({
    queryKey: ["persona", personaId],
    queryFn: () => getPersona(personaId!),
    enabled: isEditMode,
  });

  const { data: models, isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const isLoading = isLoadingPersona || isModelsLoading;

  useEffect(() => {
    if (persona && isEditMode) {
      setFormData({
        name: persona.name,
        description: persona.description,
        systemPrompt: persona.systemPrompt,
        temperature: persona.temperature,
        modelId: persona.modelId || "",
        reasoning: persona.reasoning || "none",
        color: persona.color || "#000000",
        icon: persona.icon || "Zap",
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
        await updatePersona(personaId!, {
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
          reasoning: formData.reasoning === "none" ? null : formData.reasoning,
          color: formData.color || "#000000",
          icon: formData.icon || "Zap",
          updatedAt: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["personas"] });
        queryClient.invalidateQueries({ queryKey: ["persona", personaId] });
        toast.success("Persona updated successfully!");
      } else {
        const newPersona = await createPersona({
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
          reasoning: formData.reasoning === "none" ? null : formData.reasoning,
          color: formData.color || "#000000",
          icon: formData.icon || "Zap",
        });
        queryClient.invalidateQueries({ queryKey: ["personas"] });
        queryClient.invalidateQueries({
          queryKey: ["persona", newPersona?.id],
        });
        toast.success("Persona created successfully!");
      }

      router.push("/create/personas");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} persona: ${error}`
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
              />
            ) : (
              <Skeleton className="h-10 w-full" />
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
                                      : "opacity-0"
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
                        reasoning: value as "none" | "low" | "medium" | "high",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reasoning effort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
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
              Temperature: {formData?.temperature && formData.temperature}
            </Label>
            {formData?.temperature !== undefined && !isLoading ? (
              <>
                <Slider
                  id="temperature"
                  data-testid="temperature-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={[(formData?.temperature || 0) * 100]}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      temperature: (value[0] || 0) / 100,
                    }))
                  }
                  className="w-full"
                />{" "}
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
                <Textarea
                  id="systemPrompt"
                  value={formData?.systemPrompt || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      systemPrompt: e.target.value,
                    }))
                  }
                  placeholder="System prompt that defines how the persona should behave and respond"
                  rows={20}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This prompt defines the persona's behavior and personality in
                  conversations.
                </p>
              </>
            ) : (
              <Skeleton className="h-100 w-full" />
            )}
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
            <Button type="submit" disabled={isSubmitting}>
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
