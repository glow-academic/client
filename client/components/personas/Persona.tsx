/**
 * Persona.tsx
 * Used to create and manage personas - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ReorderableList } from "@/components/common/forms/ReorderableList";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { Button } from "@/components/ui/button";
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
import { PERSONA_ICON_MAP } from "@/utils/persona-icons";
import { Check, Loader2, Power } from "lucide-react";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

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
        effectiveProfile?.primary_department_id || null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const personaDetail = serverPersonaDetail;
  const personaDetailDefault = serverPersonaDetailDefault;

  // Use edit detail when editing, default detail when creating
  const personaData = isEditMode ? personaDetail : personaDetailDefault;

  // Convert departments array to department_mapping Record (for GenericPicker)
  const departmentMapping = useMemo(() => {
    // Check if department_mapping already exists (edit mode)
    if (
      personaData &&
      "department_mapping" in personaData &&
      (
        personaData as PersonaDetailOut & {
          department_mapping?: Record<string, unknown>;
        }
      ).department_mapping
    ) {
      return (
        (
          personaData as PersonaDetailOut & {
            department_mapping?: Record<
              string,
              { id: string; name: string; description?: string }
            >;
          }
        ).department_mapping || {}
      );
    }
    // Convert departments array to mapping (new mode)
    if (
      personaData &&
      "departments" in personaData &&
      Array.isArray(
        (
          personaData as PersonaNewOut & {
            departments?: Array<{
              department_id: string;
              name: string;
              description?: string;
            }>;
          }
        ).departments
      )
    ) {
      const departments =
        (
          personaData as PersonaNewOut & {
            departments?: Array<{
              department_id: string;
              name: string;
              description?: string;
            }>;
          }
        ).departments || [];
      const mapping: Record<
        string,
        { id: string; name: string; description?: string }
      > = {};
      departments.forEach((dept) => {
        if (dept.department_id) {
          mapping[dept.department_id] = {
            id: dept.department_id,
            name: dept.name || "",
            ...(dept.description ? { description: dept.description } : {}),
          };
        }
      });
      return mapping;
    }
    return {};
  }, [personaData]);

  // Local state for search inputs (for immediate filtering, debounced updates to URL)
  const [localColorSearch, setLocalColorSearch] = useState<string>("");
  const [localIconSearch, setLocalIconSearch] = useState<string>("");

  // Inline parsers for URL-backed state (client-side only - no server-side parsing needed)
  const personaSearchParamsClient = {
    name: parseAsString,
    description: parseAsString,
    color: parseAsString,
    icon: parseAsString,
    instructions: parseAsString,
    active: parseAsBoolean,
    departmentIds: parseAsArrayOf(parseAsString),
    parameterIds: parseAsArrayOf(parseAsString),
    parameterFieldIds: parseAsArrayOf(parseAsString),
    examples: parseAsArrayOf(parseAsString),
    // Search params (URL-backed, updated via debounced callback)
    colorSearch: parseAsString,
    iconSearch: parseAsString,
  } as const;

  // URL-backed state using nuqs (managed by GenericForm, but we need access for initialization)
  const [formData, setFormData] = useQueryStates(personaSearchParamsClient, {
    history: "replace",
    shallow: false,
  });

  // Sync local search state with URL params (for browser back/forward navigation)
  useEffect(() => {
    if (formData.colorSearch !== undefined) {
      setLocalColorSearch(formData.colorSearch || "");
    }
  }, [formData.colorSearch]);

  useEffect(() => {
    if (formData.iconSearch !== undefined) {
      setLocalIconSearch(formData.iconSearch || "");
    }
  }, [formData.iconSearch]);

  // Debounced callbacks to update URL params (prevents infinite loops)
  const colorSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const iconSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const debouncedUpdateColorSearch = useCallback(
    (term: string) => {
      if (colorSearchTimeoutRef.current) {
        clearTimeout(colorSearchTimeoutRef.current);
      }
      colorSearchTimeoutRef.current = setTimeout(() => {
        setFormData({ colorSearch: term || null });
      }, 300);
    },
    [setFormData]
  );

  const debouncedUpdateIconSearch = useCallback(
    (term: string) => {
      if (iconSearchTimeoutRef.current) {
        clearTimeout(iconSearchTimeoutRef.current);
      }
      iconSearchTimeoutRef.current = setTimeout(() => {
        setFormData({ iconSearch: term || null });
      }, 300);
    },
    [setFormData]
  );

  // Handle search changes (immediate local update + debounced URL update)
  const handleColorSearchChange = (term: string) => {
    setLocalColorSearch(term);
    debouncedUpdateColorSearch(term);
  };

  const handleIconSearchChange = (term: string) => {
    setLocalIconSearch(term);
    debouncedUpdateIconSearch(term);
  };

  // Get preset colors and valid icons from server (all colors/icons, filtered client-side)
  // Server returns colors as list of objects: [{hex: "#ef4444", name: "Red"}, ...]
  const presetColorsAll = useMemo(() => {
    const colors =
      (
        personaData as PersonaDetailOut & {
          preset_colors?: Array<{ hex: string; name: string }> | string[];
        }
      )?.preset_colors || [];

    // Handle both old format (string[]) and new format (Array<{hex, name}>)
    if (colors.length > 0 && typeof colors[0] === "string") {
      // Old format - convert to new format (shouldn't happen after migration)
      return (colors as string[]).map((hex) => ({ hex, name: hex }));
    }
    return colors as Array<{ hex: string; name: string }>;
  }, [personaData]);

  // Filter colors client-side based on local search state
  const presetColors = useMemo(() => {
    if (!localColorSearch.trim()) {
      return presetColorsAll;
    }
    const searchLower = localColorSearch.toLowerCase();
    return presetColorsAll.filter(
      (color) =>
        color.name.toLowerCase().includes(searchLower) ||
        color.hex.toLowerCase().includes(searchLower)
    );
  }, [presetColorsAll, localColorSearch]);

  const suggestedIconsAll = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          suggested_icons?: string[];
        }
      )?.suggested_icons || [],
    [personaData]
  );

  const validIconsAll = useMemo(
    () =>
      (
        personaData as PersonaDetailOut & {
          valid_icons?: string[];
        }
      )?.valid_icons || [],
    [personaData]
  );

  // Combine suggested icons first, then valid icons
  const allIconsAll = useMemo(() => {
    const suggestedSet = new Set(suggestedIconsAll);
    const otherIcons = validIconsAll.filter(
      (iconName) => !suggestedSet.has(iconName)
    );
    return [...suggestedIconsAll, ...otherIcons].filter(
      (iconName) => iconName in PERSONA_ICON_MAP
    );
  }, [suggestedIconsAll, validIconsAll]);

  // Filter icons client-side based on local search state
  const allIcons = useMemo(() => {
    if (!localIconSearch.trim()) {
      return allIconsAll;
    }
    const searchLower = localIconSearch.toLowerCase();
    return allIconsAll.filter((icon) =>
      icon.toLowerCase().includes(searchLower)
    );
  }, [allIconsAll, localIconSearch]);

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
    if ("can_edit" in personaData) {
      return !(personaData as PersonaDetailOut).can_edit;
    }
    return false;
  }, [isEditMode, personaData]);

  // Extract examples from example_mapping
  const exampleMapping = useMemo(() => {
    return (
      (
        personaData as PersonaDetailOut & {
          example_mapping?: Record<string, { name: string }>;
        }
      )?.example_mapping || {}
    );
  }, [personaData]);

  // Extract examples from example_ids and example_mapping
  const getExamplesFromMapping = useCallback(
    (
      exampleIds: string[],
      mapping: Record<string, { name: string }>
    ): string[] => {
      return exampleIds.map((id) => mapping[id]?.name || "");
    },
    []
  );

  // Filter examples_history based on selected departments
  const examplesHistory = useMemo(() => {
    if (!personaData || !("examples_history" in personaData)) return [];
    const rawHistory =
      (
        personaData as PersonaDetailOut & {
          examples_history?: Array<{
            example: string;
            department_ids?: string[];
          }>;
        }
      )?.examples_history || [];
    const selectedDeptIds =
      (formData["departmentIds"] as string[] | null | undefined) || [];

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
  }, [personaData, formData]);

  // Initialize form data from server (only if URL params are empty)
  // Use a ref to track if we've initialized to avoid re-initializing on every render
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (!personaData || hasInitializedRef.current) return;

    // Check if URL has any form field params (if so, URL is source of truth, don't initialize)
    const hasUrlFormData =
      formData["name"] ||
      formData["description"] ||
      formData["color"] ||
      formData["icon"] ||
      formData["active"] !== undefined ||
      formData["instructions"] ||
      formData["departmentIds"] ||
      formData["parameterIds"] ||
      formData["parameterFieldIds"] ||
      formData["examples"];

    if (hasUrlFormData) {
      // URL params exist - they are the source of truth, don't override
      hasInitializedRef.current = true;
      return;
    }

    // URL is clean - initialize from server data, but only set fields that aren't already in URL
    // This prevents writing defaults to URL when URL is clean
    if (isEditMode && "department_ids" in personaData) {
      const personaDetail = personaData as PersonaDetailOut;
      const deptIds = personaDetail.department_ids || [];
      const exampleIds =
        (personaDetail as PersonaDetailOut & { example_ids?: string[] })
          ?.example_ids || [];
      const examples = getExamplesFromMapping(exampleIds, exampleMapping);

      // Only set fields that have values (don't write nulls/empty strings to URL)
      const updates: Record<string, unknown> = {};
      if (personaDetail.name) updates["name"] = personaDetail.name;
      if (personaDetail.description)
        updates["description"] = personaDetail.description;
      if (personaDetail.instructions)
        updates["instructions"] = personaDetail.instructions;
      if (personaDetail.color) updates["color"] = personaDetail.color;
      if (personaDetail.icon) updates["icon"] = personaDetail.icon;
      if (personaDetail.active !== undefined)
        updates["active"] = personaDetail.active;
      if (deptIds.length > 0) updates["departmentIds"] = deptIds;
      if (
        (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        )?.linked_parameter_ids &&
        (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        ).linked_parameter_ids!.length > 0
      ) {
        updates["parameterIds"] = (
          personaDetail as PersonaDetailOut & {
            linked_parameter_ids?: string[];
          }
        ).linked_parameter_ids!;
      }
      if (
        (personaDetail as PersonaDetailOut & { parameter_field_ids?: string[] })
          ?.parameter_field_ids &&
        (
          personaDetail as PersonaDetailOut & {
            parameter_field_ids?: string[];
          }
        ).parameter_field_ids!.length > 0
      ) {
        updates["parameterFieldIds"] = (
          personaDetail as PersonaDetailOut & {
            parameter_field_ids?: string[];
          }
        ).parameter_field_ids!;
      }
      if (examples.length > 0) updates["examples"] = examples;

      // Only update if we have fields to set
      if (Object.keys(updates).length > 0) {
        setFormData(updates);
      }
    } else {
      // For create mode, don't write defaults to URL - let API defaults be used internally
      // Only set fields if user explicitly changes them (which will write to URL)
      // This keeps URL clean when visiting /create/personas/new
    }

    hasInitializedRef.current = true;
  }, [
    personaData,
    isEditMode,
    defaultDepartmentIds,
    exampleMapping,
    getExamplesFromMapping,
    setFormData,
    formData,
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

    if (!formData["name"]) {
      toast.error("Persona name is required");
      return;
    }

    if (!formData["description"]) {
      toast.error("Persona description is required");
      return;
    }

    if (!formData["instructions"]) {
      toast.error("Instructions are required");
      return;
    }

    // Validate: at least one agent must be selected based on simulation type
    setIsSubmitting(true);

    try {
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds =
        transformDepartmentIdsForSubmit(
          (formData["departmentIds"] as string[] | null | undefined) || [],
          isSuperadmin,
          (
            personaData as PersonaDetailOut & {
              valid_department_ids?: string[];
            }
          )?.valid_department_ids || []
        ) ?? [];

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      if (isEditMode) {
        const nameValue = formData["name"] as string | null | undefined;
        const description = formData["description"] as
          | string
          | null
          | undefined;
        const instructions = formData["instructions"] as
          | string
          | null
          | undefined;
        if (!nameValue) {
          toast.error("Persona name is required");
          setIsSubmitting(false);
          return;
        }
        // After null check, nameValue is guaranteed to be string
        updatePersona(
          {
            persona_id: personaId!,
            name: nameValue!,
            description: description || "",
            instructions: instructions || "",
            color:
              (formData["color"] as string | null | undefined) || "#000000",
            icon: (formData["icon"] as string | null | undefined) || "Zap",
            active: (formData["active"] as boolean | null | undefined) ?? true,
            department_ids: finalDepartmentIds,
            example_ids: [],
            // profileId comes from X-Profile-Id header automatically
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
        const nameValue = formData["name"] as string | null | undefined;
        const description = formData["description"] as
          | string
          | null
          | undefined;
        const instructions = formData["instructions"] as
          | string
          | null
          | undefined;
        if (!nameValue) {
          toast.error("Persona name is required");
          setIsSubmitting(false);
          return;
        }
        // TypeScript type narrowing - nameValue is guaranteed to be string after check
        const name: string = nameValue; // Explicit type annotation helps TypeScript
        createPersona(
          {
            name,
            description: description || "",
            instructions: instructions || "",
            color:
              (formData["color"] as string | null | undefined) || "#000000",
            icon: (formData["icon"] as string | null | undefined) || "Zap",
            active: (formData["active"] as boolean | null | undefined) ?? true,
            department_ids: finalDepartmentIds,
            example_ids: (formData.examples || []).filter((ex) => ex.trim()),
            // profileId comes from X-Profile-Id header automatically
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

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(formData["name"] as string | null | undefined)?.trim();
      const hasDescription = !!(
        formData["description"] as string | null | undefined
      )?.trim();
      const hasColor = !!(
        formData["color"] as string | null | undefined
      )?.trim();
      const hasIcon = !!(formData["icon"] as string | null | undefined)?.trim();
      const hasInstructions = !!(
        formData["instructions"] as string | null | undefined
      )?.trim();

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
    []
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the persona name, description, departments, and active status.",
      },
      {
        id: "color",
        title: "Color",
        description: "Select a color for the persona.",
      },
      {
        id: "icon",
        title: "Icon",
        description: "Select an icon for the persona.",
      },
      {
        id: "content",
        title: "Personality",
        description:
          "Define instructions and example messages for the persona.",
      },
    ],
    []
  );

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
                    {(personaData as PersonaDetailOut)?.department_ids
                      ?.length === 0
                      ? "This is a default persona that cannot be edited. You can view the details but cannot make changes."
                      : "This persona is currently in use by scenarios and cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <GenericForm
            nuqsParsers={
              personaSearchParamsClient as Record<string, Parser<unknown>>
            }
            steps={steps}
            getStepStatus={getStepStatus}
            formData={formData}
            setFormData={setFormData}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            renderStep={({
              stepId,
              stepStatus,
              stepTitle,
              stepDescription,
              stepNumber,
              formData: stepFormData,
              setFormData: setStepFormData,
            }) => {
              switch (stepId) {
                case "basic":
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      editableTitle={{
                        value:
                          (stepFormData["name"] as string | null | undefined) ??
                          "",
                        onChange: (value) =>
                          setStepFormData({ name: value || null }),
                        placeholder: "e.g., Enthusiastic Student",
                        defaultName: "New Persona",
                      }}
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="description">Description *</Label>
                          <Textarea
                            id="description"
                            data-testid="input-persona-description"
                            value={
                              (stepFormData["description"] as
                                | string
                                | null
                                | undefined) || ""
                            }
                            onChange={(e) =>
                              setStepFormData({
                                description: e.target.value || null,
                              })
                            }
                            placeholder="Detailed behavior description and personality traits"
                            rows={4}
                            required
                            disabled={isReadonly}
                          />
                        </div>

                        {/* Department Selection */}
                        {personaData?.valid_department_ids &&
                        personaData.valid_department_ids.length > 1 ? (
                          <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <GenericPicker
                              items={departmentMapping}
                              itemIds={
                                (
                                  personaData as PersonaDetailOut & {
                                    valid_department_ids?: string[];
                                  }
                                )?.valid_department_ids || []
                              }
                              selectedIds={
                                (stepFormData["departmentIds"] as
                                  | string[]
                                  | null
                                  | undefined) || []
                              }
                              onSelect={(ids) =>
                                setStepFormData({
                                  departmentIds: ids.length > 0 ? ids : null,
                                })
                              }
                              getId={(dept) => (dept as { id: string }).id}
                              getLabel={(dept) =>
                                (dept as { name: string }).name || ""
                              }
                              getSearchText={(dept) =>
                                `${(dept as { name: string }).name} ${(dept as { description?: string }).description || ""}`
                              }
                              placeholder="All Departments"
                              disabled={isReadonly}
                              multiSelect={true}
                              hideSelectedChips={true}
                              buttonClassName="w-full"
                            />
                          </div>
                        ) : null}

                        {/* Required Parameters */}
                        {personaData &&
                        "linked_parameter_ids" in personaData &&
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
                              selectedParameterItemIds={
                                (stepFormData["parameterFieldIds"] as
                                  | string[]
                                  | null
                                  | undefined) || []
                              }
                              onParameterItemIdsChange={(ids) =>
                                setStepFormData({
                                  parameterFieldIds:
                                    ids.length > 0 ? ids : null,
                                })
                              }
                              disabled={isReadonly}
                            />
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
                              <Switch
                                id="active"
                                checked={
                                  (stepFormData["active"] as
                                    | boolean
                                    | null
                                    | undefined) ??
                                  (personaData as { active?: boolean })
                                    ?.active ??
                                  true
                                }
                                onCheckedChange={(checked) =>
                                  setStepFormData({ active: checked })
                                }
                                disabled={isReadonly}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">
                              Inactive personas will not be available for
                              scenarios
                            </p>
                          </div>
                        </div>
                      </div>
                    </StepCard>
                  );

                case "color": {
                  // Use URL param if present, otherwise use API default
                  // Check if explicitly set (even if null) vs undefined (not set yet)
                  const colorValue = stepFormData["color"] as
                    | string
                    | null
                    | undefined;
                  const currentColor =
                    colorValue !== undefined
                      ? colorValue
                      : (personaData as { color?: string })?.color || "#000000";

                  const handleHexInputChange = (
                    e: React.ChangeEvent<HTMLInputElement>
                  ) => {
                    const value = e.target.value;
                    // Allow any hex value (with or without #, any length)
                    if (value === "" || /^#?[0-9A-Fa-f]*$/.test(value)) {
                      setStepFormData({
                        color: value.startsWith("#") ? value : `#${value}`,
                      });
                    }
                  };

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={localColorSearch}
                      onSearchChange={handleColorSearchChange}
                      searchPlaceholder="Search colors..."
                    >
                      {presetColors.length > 0 && (
                        <SelectableGrid<{ hex: string; name: string }>
                          items={presetColors}
                          selectedId={currentColor}
                          onSelect={(colorHex) => {
                            const current = stepFormData["color"] as
                              | string
                              | null
                              | undefined;
                            setStepFormData({
                              color: colorHex === current ? null : colorHex,
                            });
                          }}
                          getId={(color) => color.hex}
                          renderItem={(color, isSelected) => (
                            <div
                              className={cn(
                                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                                "hover:shadow-md hover:bg-accent/50",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isSelected && "ring-2 ring-primary bg-accent"
                              )}
                            >
                              {/* Check icon - top right */}
                              {isSelected && (
                                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm leading-tight">
                                    {color.name}
                                  </h3>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {color.hex}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          emptyMessage="No colors found. Try adjusting your search."
                          disabled={isReadonly}
                        />
                      )}

                      {/* Hex Color Input */}
                      <div className="space-y-2">
                        <Label htmlFor="colorInput">Hex Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="colorInput"
                            value={currentColor || ""}
                            onChange={handleHexInputChange}
                            placeholder="#000000"
                            className="flex-1"
                            disabled={isReadonly}
                          />
                          <div
                            className="w-10 h-10 rounded border"
                            style={{
                              backgroundColor: currentColor || "#000000",
                            }}
                          />
                        </div>
                      </div>
                    </StepCard>
                  );
                }

                case "icon": {
                  // Use URL param if present, otherwise use API default
                  // Check if explicitly set (even if null) vs undefined (not set yet)
                  const iconValue = stepFormData["icon"] as
                    | string
                    | null
                    | undefined;
                  const currentIcon =
                    iconValue !== undefined
                      ? iconValue
                      : (personaData as { icon?: string })?.icon || "Zap";

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={localIconSearch}
                      onSearchChange={handleIconSearchChange}
                      searchPlaceholder="Search icons..."
                    >
                      <SelectableGrid
                        items={allIcons}
                        selectedId={currentIcon}
                        onSelect={(icon) => {
                          const current = stepFormData["icon"] as
                            | string
                            | null
                            | undefined;
                          setStepFormData({
                            icon: icon === current ? null : icon,
                          });
                        }}
                        getId={(icon) => icon}
                        renderItem={(iconName, isSelected) => {
                          const IconComponent =
                            PERSONA_ICON_MAP[
                              iconName as keyof typeof PERSONA_ICON_MAP
                            ];
                          if (!IconComponent) return null;

                          const isSuggested =
                            suggestedIconsAll.includes(iconName);

                          return (
                            <div
                              className={cn(
                                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                                "hover:shadow-md hover:bg-accent/50",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isSelected && "ring-2 ring-primary bg-accent"
                              )}
                            >
                              {/* Check icon - top right */}
                              {isSelected && (
                                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                              )}

                              {/* Suggested badge - top left */}
                              {isSuggested && !isSelected && (
                                <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                  Suggested
                                </div>
                              )}

                              <div className="flex flex-col items-center gap-2">
                                <IconComponent className="h-8 w-8 text-foreground" />
                                <span className="text-sm font-medium text-center">
                                  {iconName}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                        emptyMessage="No icons found. Try adjusting your search."
                        disabled={isReadonly}
                      />
                    </StepCard>
                  );
                }

                case "content":
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                    >
                      {/* Instructions */}
                      <div className="space-y-2">
                        <Label htmlFor="instructions">Instructions *</Label>
                        <Textarea
                          id="instructions"
                          data-testid="input-instructions"
                          value={
                            (stepFormData["instructions"] as
                              | string
                              | null
                              | undefined) || ""
                          }
                          onChange={(e) =>
                            setStepFormData({
                              instructions: e.target.value || null,
                            })
                          }
                          placeholder="Instructions that define how the persona should behave and respond."
                          rows={8}
                          required
                          disabled={isReadonly}
                        />
                        <p className="text-xs text-muted-foreground">
                          Define the persona's behavior, communication style,
                          and response patterns
                        </p>
                      </div>

                      {/* Examples Section */}
                      <div className="space-y-2 pt-2">
                        <Label className="text-sm">Example Messages</Label>
                        <p className="text-xs text-muted-foreground">
                          Add example messages to guide the persona's
                          communication style
                        </p>
                        <ReorderableList
                          items={formData.examples || []}
                          onItemsChange={(items) =>
                            setFormData({
                              examples: items.length > 0 ? items : null,
                            })
                          }
                          suggestions={examplesHistory}
                          maxItems={10}
                          addButtonLabel="Add example"
                          disabled={isReadonly}
                        />
                      </div>
                    </StepCard>
                  );

                default:
                  return null;
              }
            }}
          />

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
