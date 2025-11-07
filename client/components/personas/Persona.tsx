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
  DeletePersonaPromptIn,
  DeletePersonaPromptOut,
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
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  getPersonaIconComponent,
  PERSONA_ICON_MAP,
} from "@/utils/persona-icons";
import {
  Bug,
  Check,
  ChevronsUpDown,
  Copy,
  Eye,
  Power,
  Trash2,
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
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
  deletePersonaPromptAction?: (
    input: DeletePersonaPromptIn
  ) => Promise<DeletePersonaPromptOut>;
}

export default function Persona({
  personaId,
  mode = personaId ? "edit" : "create",
  personaDetail: serverPersonaDetail,
  personaDetailDefault: serverPersonaDetailDefault,
  createPersonaAction,
  updatePersonaAction,
  deletePersonaPromptAction,
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
  const [showDeletePromptDialog, setShowDeletePromptDialog] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<{
    promptId: string;
    isDepartmentSpecific: boolean;
  } | null>(null);

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

  // Delete persona prompt handler using server action
  const deletePersonaPrompt = (
    body: {
      personaId: string;
      promptId: string;
      departmentId: string | null;
    },
    options?: { onSuccess?: () => void; onError?: (error: Error) => void }
  ) => {
    if (!deletePersonaPromptAction) {
      const error = new Error("deletePersonaPromptAction is required");
      options?.onError?.(error);
      if (!options?.onError) {
        toast.error(`Failed to delete prompt: ${error.message}`);
      }
      return;
    }

    deletePersonaPromptAction({
      body: {
        personaId: body.personaId,
        promptId: body.promptId,
        departmentId: body.departmentId,
      },
    })
      .then(() => {
        router.refresh(); // Refresh to get updated data
        options?.onSuccess?.();
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(err);
        if (!options?.onError) {
          toast.error(`Failed to delete prompt: ${err.message}`);
        }
      });
  };

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !personaData) return false;
    return !personaData.can_edit;
  }, [isEditMode, personaData]);

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
                      triggerProps={{
                        "data-testid": "picker-department-filter",
                      }}
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
                        triggerProps={{ "data-testid": "picker-prompt" }}
                      />
                    )}
                  {formData?.systemPrompt !== undefined && (
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
                                  ? "Branch from Default"
                                  : "Duplicate"}
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
                      {isEditMode &&
                        formData?.promptId &&
                        filteredPromptMapping[formData.promptId]
                          ?.can_delete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const promptId = formData.promptId!;
                                  const promptInfo =
                                    filteredPromptMapping[promptId];
                                  if (!promptInfo) return;
                                  setPromptToDelete({
                                    promptId,
                                    isDepartmentSpecific:
                                      !!promptInfo.department_ids &&
                                      promptInfo.department_ids.length > 0,
                                  });
                                  setShowDeletePromptDialog(true);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                    </>
                  )}
                </div>
              </div>
              {formData?.systemPrompt !== undefined ? (
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
                    <div
                      className="h-[500px]"
                      data-testid="editor-system-prompt"
                    >
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
                            <PersonaDebugInfoSection
                              rows={personaDebugInfoRows}
                            />
                          ) : undefined
                        }
                        activeMode={editorMode}
                      />
                    </div>
                  )}
                </>
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

        {/* Delete Prompt Confirmation Dialog */}
        <AlertDialog
          open={showDeletePromptDialog}
          onOpenChange={setShowDeletePromptDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
              <AlertDialogDescription>
                {promptToDelete?.isDepartmentSpecific ? (
                  <>
                    Are you sure you want to delete this department-specific
                    prompt? This will delete the prompt and fall back to the
                    default prompt for this department.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete this prompt? This will
                    delete the prompt and set the latest prompt as active.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeletePromptDialog(false);
                  setPromptToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!promptToDelete || !personaId) return;

                  deletePersonaPrompt(
                    {
                      personaId,
                      promptId: promptToDelete.promptId,
                      departmentId: promptToDelete.isDepartmentSpecific
                        ? selectedDepartmentId || null
                        : null,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Prompt deleted successfully");
                        setShowDeletePromptDialog(false);
                        setPromptToDelete(null);
                        // Refresh persona detail - the query will automatically refetch
                      },
                      onError: (error) => {
                        toast.error(
                          `Failed to delete prompt: ${error.message}`
                        );
                      },
                    }
                  );
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
