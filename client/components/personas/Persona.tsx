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
  PersonaDetailDefaultOut,
  PersonaDetailOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
} from "@/app/(main)/create/personas/p/[personaId]/page";
import UnifiedPromptEditor from "@/components/common/editor/UnifiedPromptEditor";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ModelPicker } from "@/components/common/forms/ModelPicker";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { ReasoningPicker } from "@/components/common/forms/ReasoningPicker";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  getPersonaIconComponent,
  PERSONA_ICON_MAP,
} from "@/utils/persona-icons";
import {
  Bug,
  Check,
  ChevronsUpDown,
  Eye,
  Power,
  RotateCcw,
} from "lucide-react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

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

type PersonaDebugInfoRow = {
  id: string;
  createdAt: string;
  content: string;
  modelId: string | null;
  modelName: string;
};

interface PersonaDebugInfoSectionProps {
  rows: PersonaDebugInfoRow[];
}

function PersonaDebugInfoSection({ rows }: PersonaDebugInfoSectionProps) {
  const columns = React.useMemo<ColumnDef<PersonaDebugInfoRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "modelId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.modelName || row.original.modelId}
          </Badge>
        ),
        enableColumnFilter: true,
        enableSorting: true,
      },
      {
        accessorKey: "content",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Content" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[800px] whitespace-pre-wrap break-words text-sm">
            {row.original.content}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB, columnId) => {
          const a = ((rowA.getValue(columnId) as string) || "").length;
          const b = ((rowB.getValue(columnId) as string) || "").length;
          if (a === b) return 0;
          return a > b ? 1 : -1;
        },
      },
    ],
    []
  );

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    rows.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-3 p-3 font-medium text-sm bg-muted/50">
          <div className="col-span-3">
            <DataTableColumnHeader
              column={table.getColumn("createdAt")!}
              title="Created"
            />
          </div>
          <div className="col-span-3">
            <DataTableColumnHeader
              column={table.getColumn("modelId")!}
              title="Model"
            />
          </div>
          <div className="col-span-6">
            <DataTableColumnHeader
              column={table.getColumn("content")!}
              title="Content"
            />
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="divide-y">
            {tableRows.length ? (
              tableRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-3 p-3 text-sm"
                >
                  <div className="col-span-3 whitespace-nowrap">
                    {new Date(row.original.createdAt).toLocaleString()}
                  </div>
                  <div className="col-span-3">
                    <Badge variant="outline">
                      {row.original.modelName || row.original.modelId}
                    </Badge>
                  </div>
                  <div className="col-span-6 whitespace-pre-wrap break-words">
                    {row.original.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No debug info yet for this persona.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export interface PersonaProps {
  personaId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  personaDetail?: PersonaDetailOut;
  personaDetailDefault?: PersonaDetailDefaultOut;
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
      systemPrompt: "",
      promptId: null,
      temperature: 0.0,
      modelId: "",
      reasoning: "none",
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
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );
  const prevDepartmentIdsRef = React.useRef<string[]>([]);

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

  // Filter prompt_mapping client-side based on selected departments from form
  // API returns all prompts user has access to, then we filter by selected departments
  // Show: default prompt + prompts for selected departments + cross-department prompts (no department_ids)
  const filteredPromptMapping = useMemo(() => {
    if (!isEditMode || !personaData?.prompt_mapping) {
      return personaData?.prompt_mapping || {};
    }

    const selectedDeptIds = formData?.departmentIds || [];
    const filtered: Record<string, PromptInfo> = {};

    for (const [promptId, promptInfoRaw] of Object.entries(
      personaData.prompt_mapping
    )) {
      // Add default values for name and description if missing (for backward compatibility)
      // Type assertion needed because API schema may not be fully updated in TypeScript types
      const rawInfo = promptInfoRaw as PromptInfo & {
        name?: string;
        description?: string;
      };
      const promptInfo: PromptInfo = {
        ...promptInfoRaw,
        name: rawInfo.name || "",
        description: rawInfo.description || "",
      };

      // Always include default prompt (no department_ids)
      if (
        !promptInfo.department_ids ||
        promptInfo.department_ids.length === 0
      ) {
        filtered[promptId] = promptInfo;
      } else if (selectedDeptIds.length === 0) {
        // "All Departments" selected - show ALL prompts including department-specific ones
        filtered[promptId] = promptInfo;
      } else {
        // Specific departments selected - show prompts for those departments
        if (
          promptInfo.department_ids.some((deptId) =>
            selectedDeptIds.includes(deptId)
          )
        ) {
          filtered[promptId] = promptInfo;
        }
      }
    }
    return filtered;
  }, [formData?.departmentIds, personaData?.prompt_mapping, isEditMode]);

  // Get default prompt content (from persona_prompts table)
  const defaultPromptContent = useMemo(() => {
    if (!isEditMode || !personaData?.prompt_id || !personaData?.prompt_mapping)
      return "";
    const defaultPrompt = personaData.prompt_mapping[personaData.prompt_id];
    return defaultPrompt?.system_prompt || "";
  }, [personaData, isEditMode]);

  // Get resolved prompt (what's actually saved/configured for selected departments from form)
  // This is what would be used in production for the selected department(s)
  const resolvedPrompt = useMemo(() => {
    if (!isEditMode || !personaData?.prompt_mapping) {
      return { promptId: null, content: "" };
    }

    const selectedDeptIds = formData?.departmentIds || [];
    if (selectedDeptIds.length === 0) {
      // "All Departments" - use default prompt
      return {
        promptId: personaData.prompt_id || null,
        content: defaultPromptContent,
      };
    }

    // For multiple departments, check if all have the same prompt
    const firstDeptId = selectedDeptIds[0]!;
    const firstPromptId =
      personaData.department_prompt_links?.[firstDeptId] ||
      personaData.prompt_id ||
      null;

    // Check if all selected departments have the same prompt
    const allSamePrompt = selectedDeptIds.every((deptId) => {
      const promptId =
        personaData.department_prompt_links?.[deptId] ||
        personaData.prompt_id ||
        null;
      return promptId === firstPromptId;
    });

    if (allSamePrompt && firstPromptId) {
      const promptInfo = personaData.prompt_mapping[firstPromptId];
      return {
        promptId: firstPromptId,
        content: promptInfo?.system_prompt || defaultPromptContent,
      };
    }

    // Mixed prompts - return default
    return {
      promptId: personaData.prompt_id || null,
      content: defaultPromptContent,
    };
  }, [
    formData?.departmentIds,
    personaData?.prompt_mapping,
    personaData?.department_prompt_links,
    personaData?.prompt_id,
    defaultPromptContent,
    isEditMode,
  ]);

  const resolvedPromptContent = resolvedPrompt.content;

  // Check if current prompt content differs from resolved prompt
  const hasPromptChanges = useMemo(() => {
    if (!formData?.systemPrompt) return false;
    return formData.systemPrompt !== resolvedPromptContent;
  }, [formData?.systemPrompt, resolvedPromptContent]);

  const personaDebugInfoRows = useMemo<PersonaDebugInfoRow[]>(() => {
    if (!personaData?.debug_info) return [];
    return personaData.debug_info.map((item, idx) => {
      const createdAt =
        (item as { timestamp?: string }).timestamp ||
        (item as { created_at?: string }).created_at ||
        "";
      const modelId =
        (item as { model_id?: string }).model_id ??
        (item as { modelId?: string }).modelId ??
        null;
      const content =
        (item as { message?: string }).message ||
        (item as { content?: string }).content ||
        "";
      const modelName =
        modelId && personaData.model_mapping
          ? personaData.model_mapping[modelId]?.name || modelId
          : modelId || "";

      return {
        id: `${createdAt}-${idx}`,
        createdAt,
        content,
        modelId,
        modelName,
      };
    });
  }, [personaData?.debug_info, personaData?.model_mapping]);

  useEffect(() => {
    if (personaData && isEditMode) {
      const deptIds = personaData.department_ids || [];
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
        departmentIds: deptIds,
      });
      // Initialize the ref for department change tracking
      prevDepartmentIdsRef.current = [...deptIds];
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

  // Update prompt when department selection changes in form
  useEffect(() => {
    if (!isEditMode || !personaData || !formData?.departmentIds) return;

    // Track department changes - compare arrays
    const prevIds = prevDepartmentIdsRef.current;
    const currentIds = formData.departmentIds || [];
    const departmentChanged =
      prevIds.length !== currentIds.length ||
      !prevIds.every((id) => currentIds.includes(id));

    if (departmentChanged) {
      prevDepartmentIdsRef.current = [...currentIds];
    }

    // Only auto-set if user hasn't made changes (compare content to resolved prompt)
    if (hasPromptChanges && !departmentChanged) return;

    // Only auto-set when department changes - use resolvedPrompt which is computed for current selection
    if (departmentChanged) {
      setFormData((prev) => ({
        ...prev,
        promptId: resolvedPrompt.promptId,
        systemPrompt: resolvedPrompt.content,
      }));
    }
  }, [
    formData?.departmentIds,
    personaData,
    isEditMode,
    resolvedPrompt,
    hasPromptChanges,
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
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        personaData?.valid_department_ids || []
      );

      if (isEditMode) {
        // Safety check: Only create/update overrides for departments that:
        // 1. Don't have an override yet (use default), OR
        // 2. Are the only department selected, OR
        // 3. All selected departments share the same existing override prompt
        const selectedDeptIds = formData.departmentIds || [];
        let departmentsForPromptOverride: string[] = [];

        if (hasPromptChanges) {
          const targetDeptIds =
            selectedDeptIds.length === 0
              ? personaData?.valid_department_ids || []
              : selectedDeptIds;

          if (targetDeptIds.length > 0) {
            // If only one department selected, always allow update
            if (targetDeptIds.length === 1) {
              departmentsForPromptOverride = targetDeptIds;
            } else {
              // For multiple departments, check which ones are safe to update
              const departmentPromptLinks =
                personaData?.department_prompt_links || {};
              const existingPromptIds = targetDeptIds
                .map((deptId) => departmentPromptLinks[deptId])
                .filter((promptId) => promptId !== undefined);

              const allShareSamePrompt =
                existingPromptIds.length > 0 &&
                existingPromptIds.every(
                  (promptId) => promptId === existingPromptIds[0]
                );

              if (allShareSamePrompt) {
                // All departments share the same override - safe to update all
                departmentsForPromptOverride = targetDeptIds;
              } else {
                // Not all share same prompt - only update departments without overrides
                const safeToUpdate: string[] = [];
                for (const deptId of targetDeptIds) {
                  if (!departmentPromptLinks[deptId]) {
                    // Department doesn't have an override - safe to create one
                    safeToUpdate.push(deptId);
                  }
                }
                departmentsForPromptOverride = safeToUpdate;
              }
            }
          }
        }

        // Always create new prompt version if content differs from resolved prompt
        // Never create default prompts - always create department-specific overrides
        const shouldCreateNewPrompt = hasPromptChanges;

        updatePersona(
          {
            personaId: personaId!,
            name: formData.name,
            description: formData.description || null,
            prompt_id: shouldCreateNewPrompt ? null : formData.promptId || null,
            system_prompt: formData.systemPrompt,
            temperature: Number(formData.temperature),
            model_id: formData.modelId,
            reasoning:
              formData.reasoning === "none" ? null : formData.reasoning || null,
            color: formData.color || "#000000",
            icon: formData.icon || "Zap",
            active: formData.active ?? true,
            department_ids: finalDepartmentIds,
            department_ids_for_prompt: departmentsForPromptOverride,
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
            department_ids: finalDepartmentIds,
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

            {/* Text Model, Reasoning Effort, and Temperature - 3 Column Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Text Model */}
              <div className="space-y-2">
                <Label htmlFor="modelId">Text Model *</Label>
                {formData?.modelId !== undefined ? (
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
                    triggerProps={{ "data-testid": "picker-model" }}
                  />
                ) : null}
              </div>

              {/* Reasoning Effort */}
              <div className="space-y-2">
                <Label htmlFor="reasoning">Reasoning Effort</Label>
                {formData?.reasoning !== undefined ? (
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
                    triggerProps={{ "data-testid": "picker-reasoning" }}
                  />
                ) : null}
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature:{" "}
                  {formData?.temperature !== undefined
                    ? formData.temperature.toFixed(2)
                    : "0.00"}
                </Label>
                {formData?.temperature !== undefined ? (
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
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <div className="flex gap-2">
                  {isEditMode &&
                    personaData &&
                    filteredPromptMapping &&
                    (Object.keys(filteredPromptMapping).length > 0 ||
                      (formData?.departmentIds &&
                        formData.departmentIds.length > 0)) && (
                      <PromptPicker
                        promptMapping={filteredPromptMapping}
                        selectedPromptId={formData?.promptId || null}
                        defaultPromptId={personaData?.prompt_id || null}
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
                        placeholder="Select prompt..."
                        disabled={isReadonly}
                        buttonClassName="h-8"
                        triggerProps={{ "data-testid": "picker-prompt" }}
                      />
                    )}
                  {formData?.systemPrompt !== undefined && (
                    <>
                      {hasPromptChanges && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  systemPrompt: resolvedPromptContent,
                                  promptId: resolvedPrompt.promptId,
                                }));
                              }}
                              className="h-8 w-8 p-0"
                              data-testid="btn-reset-changes"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reset to saved prompt</p>
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
              {formData?.systemPrompt !== undefined ? (
                <div className="h-[500px]" data-testid="editor-system-prompt">
                  <UnifiedPromptEditor
                    value={formData?.systemPrompt || ""}
                    onChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        systemPrompt: value,
                        promptId: null, // Clear promptId when editing, indicating new prompt version
                      }));
                    }}
                    placeholder="System prompt that defines how the persona should behave and respond. You can use markdown formatting."
                    disabled={isReadonly}
                    className="h-full"
                    debugContent={
                      isEditMode &&
                      personaData &&
                      effectiveProfile?.role === "superadmin" ? (
                        <PersonaDebugInfoSection rows={personaDebugInfoRows} />
                      ) : undefined
                    }
                    activeMode={editorMode}
                  />
                </div>
              ) : null}
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
