/**
 * Rubric.tsx
 * Step-based rubric editing component with GenericForm pattern
 * 4 steps:
 * 1. Basic Information (name, description, department, active)
 * 2. Standard Groups (card grid for adding/editing groups)
 * 3. Group Configuration (accordion with standards/levels per group)
 * 4. Preview (grid view with generate button)
 */
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import {
  RubricStandardGroupCardGrid,
  type StandardGroupCard,
} from "@/components/rubrics/RubricStandardGroupCardGrid";
import { RubricStandardSection } from "@/components/rubrics/RubricStandardSection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { transformDepartmentIdsForSubmit } from "@/utils/department-picker-helpers";
import { Power, Sparkles } from "lucide-react";
import {
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";
import { toast } from "sonner";

// Type-only import from server page
import type {
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/engine/rubrics/page";
import type {
  PatchRubricDraftIn,
  PatchRubricDraftOut,
  RubricDetailOut,
  RubricNewOut,
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/engine/rubrics/r/[rubricId]/page";

// Types
type StandardGroup = {
  id: string;
  name: string;
  description: string;
  points: number;
  passPoints: number;
  position: number;
  active: boolean;
};

type Standard = {
  id: string;
  name: string;
  points: number;
  standardGroupId: string;
};

type GridCell = {
  standardGroupId: string;
  standardId: string;
  description: string;
};

export interface RubricProps {
  rubricId?: string;
  rubricDetail?: RubricDetailOut;
  rubricDetailDefault?: RubricNewOut;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  patchRubricDraftAction?: (
    input: PatchRubricDraftIn
  ) => Promise<PatchRubricDraftOut>;
}

export default function Rubric({
  rubricId,
  rubricDetail: serverRubricDetail,
  rubricDetailDefault: serverRubricDetailDefault,
  updateRubricAction,
  createRubricAction,
  patchRubricDraftAction,
}: RubricProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!rubricId;
  const { effectiveProfile, socket, isConnected, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = useCallback(
    (
      data: typeof serverRubricDetail | typeof serverRubricDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("rubric_id" in data && data.rubric_id) {
          return `rubric_id:${String(data.rubric_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const rubricDetailId = useMemo(
    () => stabilizeServerProp(serverRubricDetail),
    [serverRubricDetail, stabilizeServerProp]
  );
  const rubricDetailDefaultId = useMemo(
    () => stabilizeServerProp(serverRubricDetailDefault),
    [serverRubricDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerRubricDetailRef = useRef(serverRubricDetail);
  const latestServerRubricDetailDefaultRef = useRef(serverRubricDetailDefault);

  latestServerRubricDetailRef.current = serverRubricDetail;
  latestServerRubricDetailDefaultRef.current = serverRubricDetailDefault;

  // Use refs to track stable server props - only update when ID changes
  const stableRubricDetailRef = useRef<{
    data: typeof serverRubricDetail;
    id: string | null;
  }>({
    data: serverRubricDetail,
    id: rubricDetailId,
  });
  const stableRubricDetailDefaultRef = useRef<{
    data: typeof serverRubricDetailDefault;
    id: string | null;
  }>({
    data: serverRubricDetailDefault,
    id: rubricDetailDefaultId,
  });

  useEffect(() => {
    if (stableRubricDetailRef.current.id !== rubricDetailId) {
      stableRubricDetailRef.current = {
        data: latestServerRubricDetailRef.current,
        id: rubricDetailId,
      };
    }
  }, [rubricDetailId]);

  useEffect(() => {
    if (stableRubricDetailDefaultRef.current.id !== rubricDetailDefaultId) {
      stableRubricDetailDefaultRef.current = {
        data: latestServerRubricDetailDefaultRef.current,
        id: rubricDetailDefaultId,
      };
    }
  }, [rubricDetailDefaultId]);

  // Use stable references
  const rubricDetail = stableRubricDetailRef.current.data;
  const rubricDetailDefault = stableRubricDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const rubricDataId = useMemo(() => {
    const data = isEditMode ? rubricDetail : rubricDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("rubric_id" in data && data.rubric_id) {
        return `rubric_id:${String(data.rubric_id)}`;
      }
      const keyFields: Record<string, unknown> = {};
      if ("valid_department_ids" in data) {
        keyFields["valid_department_ids"] = Array.isArray(
          data["valid_department_ids"]
        )
          ? data["valid_department_ids"].sort().join(",")
          : data["valid_department_ids"];
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, rubricDetail, rubricDetailDefault]);

  const stableRubricDataRef = useRef<{
    data: typeof rubricDetail | typeof rubricDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? rubricDetail : rubricDetailDefault,
    id: rubricDataId,
  });

  useEffect(() => {
    if (stableRubricDataRef.current.id !== rubricDataId) {
      stableRubricDataRef.current = {
        data: isEditMode ? rubricDetail : rubricDetailDefault,
        id: rubricDataId,
      };
    }
  }, [isEditMode, rubricDetail, rubricDetailDefault, rubricDataId]);

  const rubricData = stableRubricDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only)
  const rubricSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(rubricSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL) - for form fields
  type DraftState = {
    name: string;
    description: string;
    active: boolean;
    departmentIds: string[];
    rubricAgentId: string | null;
    standardGroups: StandardGroup[];
    standards: Standard[];
    gridCells: GridCell[];
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? rubricDetail : rubricDetailDefault;
    
    // Extract nested objects from draft payload first (if draft exists)
    let standardGroups: StandardGroup[] = [];
    let standards: Standard[] = [];
    let gridCells: GridCell[] = [];

    // Try to read from draft payload fields (returned by SQL when draft exists)
    if (data && "draft_standard_groups" in data && data.draft_standard_groups) {
      try {
        const parsed =
          typeof data.draft_standard_groups === "string"
            ? JSON.parse(data.draft_standard_groups)
            : data.draft_standard_groups;
        if (parsed && Array.isArray(parsed)) {
          standardGroups = parsed
            .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
            .map((g) => ({
              id: (typeof g["id"] === "string" ? g["id"] : undefined) || `temp-${Date.now()}-${Math.random()}`,
              name: (typeof g["name"] === "string" ? g["name"] : "") || "",
              description: (typeof g["description"] === "string" ? g["description"] : "") || "",
              points: (typeof g["points"] === "number" ? g["points"] : undefined) || 5,
              passPoints: (typeof g["passPoints"] === "number" ? g["passPoints"] : undefined) || 4,
              position: (typeof g["position"] === "number" ? g["position"] : undefined) || 1,
              active: (typeof g["active"] === "boolean" ? g["active"] : undefined) ?? true,
            }));
        }
      } catch {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    if (data && "draft_standards" in data && data.draft_standards) {
      try {
        const parsed =
          typeof data.draft_standards === "string"
            ? JSON.parse(data.draft_standards)
            : data.draft_standards;
        if (parsed && Array.isArray(parsed)) {
          standards = parsed
            .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
            .map((s) => ({
              id: (typeof s["id"] === "string" ? s["id"] : undefined) || `temp-${Date.now()}-${Math.random()}`,
              name: (typeof s["name"] === "string" ? s["name"] : "") || "",
              points: (typeof s["points"] === "number" ? s["points"] : undefined) || 1,
              standardGroupId: (typeof s["standardGroupId"] === "string" ? s["standardGroupId"] : undefined) ||
                (typeof s["standard_group_id"] === "string" ? s["standard_group_id"] : undefined) || "",
            }));
        }
      } catch {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    if (data && "draft_grid_cells" in data && data.draft_grid_cells) {
      try {
        const parsed =
          typeof data.draft_grid_cells === "string"
            ? JSON.parse(data.draft_grid_cells)
            : data.draft_grid_cells;
        if (parsed && Array.isArray(parsed)) {
          // gridCells is an array of GridCell objects
          gridCells = parsed
            .filter((cell): cell is Record<string, unknown> => typeof cell === "object" && cell !== null)
            .map((cell) => ({
              standardGroupId: (typeof cell["standardGroupId"] === "string" ? cell["standardGroupId"] : undefined) ||
                (typeof cell["standard_group_id"] === "string" ? cell["standard_group_id"] : undefined) || "",
              standardId: (typeof cell["standardId"] === "string" ? cell["standardId"] : undefined) ||
                (typeof cell["standard_id"] === "string" ? cell["standard_id"] : undefined) || "",
              description: (typeof cell["description"] === "string" ? cell["description"] : "") || "",
            }));
        } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Fallback: Convert JSONB object to array of GridCell (for backward compatibility)
          Object.entries(parsed).forEach(([key, value]) => {
            const [standardGroupId, standardId] = key.split(":");
            if (standardGroupId && standardId) {
              const valueObj = value && typeof value === "object" ? value as Record<string, unknown> : null;
              gridCells.push({
                standardGroupId,
                standardId,
                description: (valueObj && "description" in valueObj ? String(valueObj["description"]) : "") || (typeof value === "string" ? value : ""),
              });
            }
          });
        }
      } catch {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    // Fall back to extracting from server data arrays if draft payload doesn't exist
    if (standardGroups.length === 0 && data && "standard_groups" in data && data.standard_groups) {
      const groups: StandardGroup[] = [];
      if (Array.isArray(data.standard_groups)) {
        data.standard_groups.forEach((group) => {
          if (typeof group === "object" && group !== null && "standard_group_id" in group && group.standard_group_id) {
            groups.push({
              id: String(group.standard_group_id),
              name: group.name || "",
              description: group.description || "",
              points: group.points || 0,
              passPoints: group.pass_points || 0,
              position: group.position ?? 1,
              active: group.active ?? true,
            });
          }
        });
      }
      groups.sort((a, b) => a.position - b.position);
      standardGroups = groups;
    }

    if (standards.length === 0 && data && "standard_groups" in data && data.standard_groups && "standards" in data && data.standards) {
      const standardsList: Standard[] = [];
      const cells: GridCell[] = [];
      if (Array.isArray(data.standard_groups) && Array.isArray(data.standards)) {
        data.standard_groups.forEach((group) => {
          if (typeof group === "object" && group !== null && "standard_group_id" in group && group.standard_group_id && "standard_ids" in group && Array.isArray(group.standard_ids)) {
            const groupId = String(group.standard_group_id);
            group.standard_ids.forEach((standardId: string) => {
              const standard = data.standards?.find(
                (s): s is { standard_id: string | null; name: string | null; description: string | null; points: number | null } =>
                  typeof s === "object" && s !== null && "standard_id" in s && s.standard_id === standardId
              );
              if (standard && standard.standard_id) {
                const name = standard.name;
                const points = standard.points;
                if (name && typeof points === "number") {
                  standardsList.push({
                    id: String(standardId),
                    name,
                    points,
                    standardGroupId: groupId,
                  });
                  cells.push({
                    standardGroupId: groupId,
                    standardId: String(standardId),
                    description: standard.description || "",
                  });
                }
              }
            });
          }
        });
      }
      standards = standardsList;
      if (gridCells.length === 0) {
        gridCells = cells;
      }
    }

    return {
      name: data?.name || "New Rubric",
      description: data?.description || "",
      active: data?.active ?? true,
      departmentIds: data?.department_ids || [],
      rubricAgentId: data?.rubric_agent_id || null,
      standardGroups,
      standards,
      gridCells,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    rubricDetail,
    rubricDetailDefault,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    rubricDetailDefault?.name,
    rubricDetailDefault?.description,
    rubricDetailDefault?.department_ids,
    rubricDetail?.name,
    rubricDetail?.description,
    rubricDetail?.department_ids,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      // Check if new state is "empty" (no name, no standardGroups) but current state has content
      const newStateIsEmpty =
        (!initialDraftState.name || initialDraftState.name.trim() === "" || initialDraftState.name === "New Rubric") &&
        (initialDraftState.standardGroups?.length || 0) === 0;

      setDraftState((currentDraftState) => {
        const currentStateHasContent =
          (currentDraftState.name?.trim() || "").length > 0 &&
          currentDraftState.name !== "New Rubric" ||
          (currentDraftState.standardGroups?.length || 0) > 0;

        // Prevent overwriting with empty values if current state has content
        // BUT: Always update boolean fields from initialDraftState
        if (newStateIsEmpty && currentStateHasContent) {
          // Keep current state but update boolean fields from initialDraftState
          return {
            ...currentDraftState,
            active: initialDraftState.active,
          };
        }

        // Otherwise, update with full initialDraftState
        return initialDraftState;
      });

      prevInitialDraftStateRef.current = newStateStr;
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: rubricData?.draft_version || 0,
    patchDraftAction: patchRubricDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchRubricDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchRubricDraftIn["body"],
          });
          // Transform backend API → hook API
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Set breadcrumb context
  useEffect(() => {
    if (rubricDetail?.name && rubricId && isEditMode) {
      setEntityMetadata({
        entityId: rubricId,
        entityName: rubricDetail.name,
        entityType: "rubric",
      });
    }
    return () => clearEntityMetadata();
  }, [
    rubricDetail,
    rubricId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!rubricData) return true;
    return !rubricData.can_edit;
  }, [isEditMode, rubricData]);

  // Auto-select rubric agent if only one option available
  useEffect(() => {
    if (!rubricData) return;

    const agents = rubricData.agents || [];
    const rubricAgentIds =
      rubricData.valid_agent_ids?.filter((id) => {
        const agent = agents.find((a) => String(a.agent_id) === id);
        return agent?.roles?.includes("rubric");
      }) || [];

    // Auto-select first rubric agent if only one option and not already set
    if (rubricAgentIds.length === 1 && !draftState.rubricAgentId) {
      setDraftState((prev) => ({
        ...prev,
        rubricAgentId: rubricAgentIds[0] || null,
      }));
    }
  }, [
    isEditMode,
    rubricData,
    draftState.rubricAgentId,
  ]);

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(draftState.name?.trim() && draftState.name !== "New Rubric");
      const hasGroups = draftState.standardGroups.length > 0;
      const hasStandards = draftState.standards.length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "groups":
          if (!hasName) return "pending";
          return hasGroups ? "completed" : "active";
        case "configuration":
          if (!hasName || !hasGroups) return "pending";
          return hasStandards ? "completed" : "active";
        case "preview":
          if (!hasName || !hasGroups || !hasStandards) return "pending";
          return "completed";
        default:
          return "pending";
      }
    },
    [draftState.name, draftState.standardGroups.length, draftState.standards.length],
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the rubric name, description, departments, and active status.",
        resetFields: [
          "name",
          "description",
          "departmentIds",
          "active",
        ] as string[],
      },
      {
        id: "groups",
        title: "Standard Groups",
        description: "Add standard groups to organize your rubric.",
        resetFields: [] as string[],
      },
      {
        id: "configuration",
        title: "Group Configuration",
        description: "Configure standards and levels for each group.",
        resetFields: [] as string[],
      },
      {
        id: "preview",
        title: "Preview",
        description: "Review your rubric grid and generate if needed.",
        resetFields: [] as string[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "departmentIds",
    ],
    []
  );

  // Form initialization from server data (returns empty object - form fields in draftState)
  const initializeForm = useCallback(
    (_serverData: unknown, _isEditMode: boolean) => {
      // Form fields are managed in draftState, not URL params
      return {};
    },
    []
  );

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formDataLocal: unknown) => {
      // Validate form
      if (!draftState.name?.trim() || draftState.name === "New Rubric") {
        toast.error("Name is required");
        return;
      }

      if (draftState.standardGroups.length === 0) {
        toast.error("At least one standard group is required");
        return;
      }

      if (draftState.standards.length === 0) {
        toast.error("At least one standard is required");
        return;
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      try {
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          draftState.departmentIds || [],
          isSuperadmin,
          rubricData?.valid_department_ids || [],
        );

        // Build standard groups array for API
        const sortedGroups = [...draftState.standardGroups].sort(
          (a, b) => a.position - b.position,
        );
        const allGroups = sortedGroups.map((group) => {
          const groupStandards = draftState.standards.filter(
            (s) => s.standardGroupId === group.id,
          );
          return {
            name: group.name,
            short_name: group.name.substring(0, 10).toUpperCase(),
            description: group.description,
            points: group.points,
            pass_points: group.passPoints,
            position: group.position,
            active: group.active,
            standards: groupStandards.map((s) => {
              const cell = draftState.gridCells.find(
                (c) => c.standardGroupId === group.id && c.standardId === s.id,
              );
              return {
                name: s.name,
                description: cell?.description || "",
                points: s.points,
              };
            }),
          };
        });

        // Calculate total points
        const totalPoints = allGroups.reduce((sum, g) => sum + g.points, 0);
        const totalPassPoints = allGroups.reduce(
          (sum, g) => sum + (g.pass_points ?? 0),
          0,
        );

        if (isEditMode) {
          if (!updateRubricAction) {
            toast.error("Update action not available");
            return;
          }
          await updateRubricAction({
            body: {
              rubric_id: rubricId!,
              name: draftState.name,
              description: draftState.description,
              active: draftState.active,
              points: totalPoints,
              pass_points: totalPassPoints,
              department_ids: finalDepartmentIds || [],
              standard_groups: allGroups,
              rubric_agent_id: draftState.rubricAgentId || null,
            },
          });
          toast.success("Rubric updated successfully");
          router.refresh();
        } else {
          if (!createRubricAction) {
            toast.error("Create action not available");
            return;
          }
          const data = await createRubricAction({
            body: {
              name: draftState.name,
              description: draftState.description,
              department_ids: finalDepartmentIds ?? [],
              active: draftState.active,
              points: totalPoints,
              pass_points: totalPassPoints,
              rubric_agent_id: draftState.rubricAgentId || null,
              standard_groups: allGroups,
            },
          });

          if (data && data.rubric_id) {
            toast.success("Rubric created successfully");
            router.push(`/engine/rubrics/r/${data.rubric_id}`);
          }
        }
      } catch (error) {
        toast.error(
          isEditMode ? "Failed to update rubric" : "Failed to create rubric",
          {
            description: error instanceof Error ? error.message : "Unknown error",
          },
        );
        throw error;
      }
    },
    [
      draftState,
      isEditMode,
      rubricId,
      isSuperadmin,
      rubricData,
      updateRubricAction,
      createRubricAction,
      router,
      effectiveProfile?.id,
    ]
  );

  // Handle standard groups change from card grid
  const handleStandardGroupsChange = useCallback(
    (newGroups: StandardGroupCard[]) => {
      // Update positions to maintain order
      const updatedGroups = newGroups.map((g, index) => ({
        id: g.id,
        name: g.name,
        description: g.description || "",
        points: g.points || 5,
        passPoints: g.passPoints || 4,
        position: index + 1,
        active: g.active ?? true,
      }));

      // Find deleted groups
      const existingGroupIds = new Set(draftState.standardGroups.map((g) => g.id));
      const newGroupIds = new Set(newGroups.map((g) => g.id));
      const deletedGroupIds = Array.from(existingGroupIds).filter(
        (id) => !newGroupIds.has(id),
      );
      const addedGroupIds = Array.from(newGroupIds).filter(
        (id) => !existingGroupIds.has(id),
      );

      // Clean up standards and grid cells for deleted groups
      let newStandards = draftState.standards;
      let newGridCells = draftState.gridCells;
      if (deletedGroupIds.length > 0) {
        newStandards = newStandards.filter(
          (s) => !deletedGroupIds.includes(s.standardGroupId),
        );
        newGridCells = newGridCells.filter(
          (c) => !deletedGroupIds.includes(c.standardGroupId),
        );
      }

      // Auto-create first standard for newly added groups
      if (addedGroupIds.length > 0) {
        const newStandardsList: Standard[] = [];
        const newGridCellsList: GridCell[] = [];

        addedGroupIds.forEach((groupId, index) => {
          const group = updatedGroups.find((g) => g.id === groupId);
          if (!group) return;

          // First standard always gets 1 point
          const newStandard: Standard = {
            id: `temp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            name: "",
            points: 1,
            standardGroupId: groupId,
          };
          newStandardsList.push(newStandard);

          // Initialize grid cells for the new standard across all groups
          updatedGroups.forEach((g) => {
            newGridCellsList.push({
              standardGroupId: g.id,
              standardId: newStandard.id,
              description: "",
            });
          });
        });

        // Initialize grid cells for all existing standards in the new groups
        newStandards.forEach((existingStandard) => {
          addedGroupIds.forEach((groupId) => {
            newGridCellsList.push({
              standardGroupId: groupId,
              standardId: existingStandard.id,
              description: "",
            });
          });
        });

        newStandards = [...newStandards, ...newStandardsList];
        newGridCells = [...newGridCells, ...newGridCellsList];
      }

      setDraftState((prev) => ({
        ...prev,
        standardGroups: updatedGroups,
        standards: newStandards,
        gridCells: newGridCells,
      }));
    },
    [draftState.standardGroups, draftState.standards, draftState.gridCells],
  );

  // Handle group metadata change
  const handleGroupChange = useCallback(
    (groupId: string, updates: Partial<StandardGroup>) => {
      setDraftState((prev) => ({
        ...prev,
        standardGroups: prev.standardGroups.map((g) =>
          g.id === groupId ? { ...g, ...updates } : g
        ),
      }));
    },
    [],
  );

  // Handle add standard
  const handleAddStandard = useCallback(
    (groupId: string) => {
      const group = draftState.standardGroups.find((g) => g.id === groupId);
      if (!group) return;

      const groupStandards = draftState.standards.filter(
        (s) => s.standardGroupId === groupId,
      );

      // Check if we've reached the maximum number of standards (group points)
      if (groupStandards.length >= group.points) {
        return;
      }

      // Find the next available points value that doesn't conflict
      const usedPoints = new Set(groupStandards.map((s) => s.points));
      let nextPoints = 1;
      while (usedPoints.has(nextPoints) && nextPoints <= group.points) {
        nextPoints++;
      }

      if (nextPoints > group.points) {
        return;
      }

      const newStandard: Standard = {
        id: `temp-${Date.now()}`,
        name: "",
        points: nextPoints,
        standardGroupId: groupId,
      };

      // Initialize grid cells for this standard
      const newGridCells: GridCell[] = [];
      draftState.standardGroups.forEach((g) => {
        newGridCells.push({
          standardGroupId: g.id,
          standardId: newStandard.id,
          description: "",
        });
      });

      setDraftState((prev) => ({
        ...prev,
        standards: [...prev.standards, newStandard],
        gridCells: [...prev.gridCells, ...newGridCells],
      }));
    },
    [draftState.standardGroups, draftState.standards],
  );

  // Handle remove standard
  const handleRemoveStandard = useCallback(
    (groupId: string, standardId: string) => {
      setDraftState((prev) => ({
        ...prev,
        standards: prev.standards.filter((s) => s.id !== standardId),
        gridCells: prev.gridCells.filter(
          (c) =>
            !(c.standardGroupId === groupId && c.standardId === standardId)
        ),
      }));
    },
    [],
  );

  // Handle grid cell change
  const handleCellChange = useCallback(
    (groupId: string, standardId: string, description: string) => {
      setDraftState((prev) => {
        const existing = prev.gridCells.find(
          (c) => c.standardGroupId === groupId && c.standardId === standardId,
        );
        if (existing) {
          return {
            ...prev,
            gridCells: prev.gridCells.map((c) =>
              c.standardGroupId === groupId && c.standardId === standardId
                ? { ...c, description }
                : c
            ),
          };
        } else {
          return {
            ...prev,
            gridCells: [
              ...prev.gridCells,
              { standardGroupId: groupId, standardId, description },
            ],
          };
        }
      });
    },
    [],
  );

  // Handle rubric generation
  const handleGenerateRubric = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    if (!draftState.rubricAgentId) {
      toast.error("Please select a rubric agent before generating");
      return;
    }

    if (draftState.standardGroups.length === 0 || draftState.standards.length === 0) {
      toast.error("Please add standard groups and standards before generating");
      return;
    }

    const departmentId = draftState.departmentIds[0] || rubricData?.valid_department_ids?.[0];
    if (!departmentId) {
      toast.error("Please select a department");
      return;
    }

    const toastId = toast.loading("Generating rubric descriptions...");

    try {
      type GenerateRubricOut = {
        success: boolean;
        message: string;
        trace_id?: string;
      };

      const result = await new Promise<GenerateRubricOut>(
        (resolve, reject) => {
          const handleProgress = (data: {
            type: string;
            message?: string;
            trace_id?: string;
          }) => {
            if (data.type === "start") {
              toast.loading(data.message || "Starting rubric generation...", {
                id: toastId,
              });
            } else if (data.type === "tool_call") {
              toast.loading(
                data.message || `Generating descriptions...`,
                { id: toastId },
              );
            }
          };

          const handleComplete = (data: {
            success: boolean;
            message: string;
            trace_id?: string;
          }) => {
            socket.off("rubrics_generation_progress", handleProgress);
            socket.off("rubrics_generation_complete", handleComplete);
            socket.off("rubrics_generation_error", handleError);
            socket.off(
              "rubrics_tools_standard_description_complete",
              handleDescriptionsComplete,
            );

            if (data.success) {
              resolve({
                success: true,
                message: data.message,
                ...(data.trace_id && { trace_id: data.trace_id }),
              });
            } else {
              reject(new Error(data.message || "Rubric generation failed"));
            }
          };

          const handleError = (data: {
            success: boolean;
            message: string;
            trace_id?: string;
          }) => {
            socket.off("rubrics_generation_progress", handleProgress);
            socket.off("rubrics_generation_complete", handleComplete);
            socket.off("rubrics_generation_error", handleError);
            socket.off(
              "rubrics_tools_standard_description_complete",
              handleDescriptionsComplete,
            );

            reject(new Error(data.message || "Rubric generation failed"));
          };

          const handleDescriptionsComplete = (data: {
            success: boolean;
            rubric_id: string;
            updated_count: number;
            trace_id?: string;
            message?: string;
            descriptions?: Array<{
              standard_group_id: string;
              standard_id: string;
              description: string;
            }>;
          }) => {
            // Update grid cells with generated descriptions
            if (data.descriptions && Array.isArray(data.descriptions)) {
              setDraftState((prev) => {
                const updatedCells = [...prev.gridCells];
                data.descriptions!.forEach((desc) => {
                  const cellIndex = updatedCells.findIndex(
                    (c) =>
                      c.standardGroupId === desc.standard_group_id &&
                      c.standardId === desc.standard_id,
                  );
                  if (cellIndex >= 0) {
                    const existingCell = updatedCells[cellIndex];
                    if (existingCell) {
                      updatedCells[cellIndex] = {
                        standardGroupId: existingCell.standardGroupId,
                        standardId: existingCell.standardId,
                        description: desc.description,
                      };
                    }
                  } else {
                    updatedCells.push({
                      standardGroupId: desc.standard_group_id,
                      standardId: desc.standard_id,
                      description: desc.description,
                    });
                  }
                });
                return {
                  ...prev,
                  gridCells: updatedCells,
                };
              });
              toast.success(
                `Generated ${data.updated_count} description${data.updated_count !== 1 ? "s" : ""}`,
                { id: toastId },
              );
            }
          };

          socket.on("rubrics_generation_progress", handleProgress);
          socket.on("rubrics_generation_complete", handleComplete);
          socket.on("rubrics_generation_error", handleError);
          socket.on(
            "rubrics_tools_standard_description_complete",
            handleDescriptionsComplete,
          );

          socket.emit("rubric_generate", {
            department_id: departmentId,
            rubric_id: isEditMode && rubricId ? rubricId : undefined,
            rubric_agent_id: draftState.rubricAgentId!,
            standard_groups: draftState.standardGroups.map((g) => ({
              id: g.id,
              name: g.name,
              description: g.description,
              points: g.points,
              pass_points: g.passPoints,
            })),
            standards: draftState.standards.map((s) => ({
              id: s.id,
              name: s.name,
              points: s.points,
              standard_group_id: s.standardGroupId,
            })),
          });
        },
      );

      if (result.success) {
        toast.success("Rubric generation completed successfully", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate rubric",
        { id: toastId },
      );
    }
  }, [socket, isConnected, draftState, rubricData, isEditMode, rubricId, setDraftState]);

  // Group level names by uniqueness for column headers
  const levelNameGroups = useMemo(() => {
    const nameMap = new Map<
      string,
      { name: string; count: number; groups: string[] }
    >();

    draftState.standardGroups.forEach((group) => {
      const groupStandards = draftState.standards.filter(
        (s) => s.standardGroupId === group.id,
      );
      groupStandards.forEach((standard) => {
        const existing = nameMap.get(standard.name);
        if (existing) {
          existing.count++;
          if (!existing.groups.includes(group.id)) {
            existing.groups.push(group.id);
          }
        } else {
          nameMap.set(standard.name, {
            name: standard.name,
            count: 1,
            groups: [group.id],
          });
        }
      });
    });

    return Array.from(nameMap.values());
  }, [draftState.standardGroups, draftState.standards]);

  // Table columns definition
  const columns = useMemo<ColumnDef<StandardGroup>[]>(() => {
    const cols: ColumnDef<StandardGroup>[] = [
      {
        id: "group",
        header: () => <div></div>, // Empty header
        cell: ({ row }) => (
          <div className="font-medium whitespace-normal break-words max-w-[200px]">
            {row.original.name}
          </div>
        ),
      },
    ];

    // Add a column for each level name group
    levelNameGroups.forEach((levelGroup, index) => {
      const headerName =
        levelGroup.count > 1
          ? `${levelGroup.name} ${index + 1}`
          : levelGroup.name;

      cols.push({
        id: `level-${levelGroup.name}-${index}`,
        header: () => <div className="font-medium">{headerName}</div>,
        cell: ({ row }) => {
          const group = row.original;
          // Find the standard for this group with this name
          const standard = draftState.standards.find(
            (s) => s.standardGroupId === group.id && s.name === levelGroup.name,
          );

          if (!standard) {
            return (
              <div className="text-xs text-muted-foreground text-center py-4">
                —
              </div>
            );
          }

          const cell = draftState.gridCells.find(
            (c) =>
              c.standardGroupId === group.id && c.standardId === standard.id,
          );

          return (
            <Textarea
              value={cell?.description || ""}
              onChange={(e) =>
                handleCellChange(group.id, standard.id, e.target.value)
              }
              placeholder="Description..."
              className="min-h-[140px] resize-none"
              disabled={isReadonly}
            />
          );
        },
      });
    });

    return cols;
  }, [levelNameGroups, draftState.standards, draftState.gridCells, isReadonly, handleCellChange]);

  // Table state - simplified, no filters or sorting
  const table = useReactTable({
    data: draftState.standardGroups,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "groups":
        return "Standard groups reset";
      case "configuration":
        return "Group configuration reset";
      case "preview":
        return "Preview reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/rubrics",
      backLabel: "Back",
      createLabel: "Create Rubric",
      updateLabel: "Update Rubric",
    }),
    []
  );

  // Render step function for GenericForm
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      isOptional: _isOptional,
      formData: _stepFormData,
      setFormData: _stepSetFormData,
      filters: _filters,
      onReset: _onReset,
    }: {
      stepId: string;
      stepStatus: StepStatus;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      isOptional: boolean;
      formData: Values<Record<string, Parser<unknown>>>;
      setFormData: (updates: Partial<Values<Record<string, Parser<unknown>>>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value: draftState.name,
                onChange: (value) =>
                  setDraftState((prev) => ({ ...prev, name: value })),
                placeholder: "New Rubric",
                defaultName: "New Rubric",
                required: true,
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rubric-description">Description</Label>
                  <Textarea
                    id="rubric-description"
                    value={draftState.description}
                    onChange={(e) =>
                      setDraftState((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Rubric Description"
                    disabled={isReadonly}
                    data-testid="input-rubric-description"
                    rows={3}
                  />
                </div>

                {/* Department Selection */}
                {rubricData?.valid_department_ids &&
                  rubricData.valid_department_ids.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <GenericPicker
                        items={(() => {
                          const mapping: Record<string, { name: string; description: string }> = {};
                          (rubricData.departments || []).forEach((dept) => {
                            if (typeof dept === "object" && dept !== null && "department_id" in dept && dept.department_id) {
                              mapping[String(dept.department_id)] = {
                                name: (typeof dept.name === "string" ? dept.name : "") || "",
                                description: (typeof dept.description === "string" ? dept.description : "") || "",
                              };
                            }
                          });
                          return mapping;
                        })()}
                        itemIds={rubricData.valid_department_ids}
                        selectedIds={draftState.departmentIds || []}
                        onSelect={(ids) =>
                          setDraftState((prev) => ({
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
                    </div>
                  )}

                {/* Rubric Agent Selection */}
                {(() => {
                  const agents = rubricData?.agents || [];
                  const rubricAgentIds =
                    rubricData?.valid_agent_ids?.filter((id) => {
                      const agent = agents.find((a): a is { agent_id: string | null; name: string | null; description: string | null; roles: string[] | null } =>
                        typeof a === "object" && a !== null && "agent_id" in a && String(a.agent_id) === id
                      );
                      return agent?.roles?.includes("rubric");
                    }) || [];

                  const showRubricPicker = rubricAgentIds.length > 0;

                  if (!showRubricPicker) {
                    return null;
                  }

                  return (
                    <div className="space-y-2">
                      <Label htmlFor="rubricAgentId">Rubric Agent</Label>
                      {draftState.rubricAgentId !== undefined ? (
                        <GenericPicker
                          items={(() => {
                            const mapping: Record<string, { name: string; description: string; roles: string[] }> = {};
                            agents.forEach((agent) => {
                              if (typeof agent === "object" && agent !== null && "agent_id" in agent && agent.agent_id) {
                                mapping[String(agent.agent_id)] = {
                                  name: (typeof agent.name === "string" ? agent.name : "") || "",
                                  description: (typeof agent.description === "string" ? agent.description : "") || "",
                                  roles: (Array.isArray(agent.roles) ? agent.roles.map(String) : []) || [],
                                };
                              }
                            });
                            return mapping;
                          })()}
                          itemIds={rubricAgentIds}
                          selectedIds={
                            draftState.rubricAgentId ? [draftState.rubricAgentId] : []
                          }
                          onSelect={(ids) =>
                            setDraftState((prev) => ({
                              ...prev,
                              rubricAgentId: ids[0] || null,
                            }))
                          }
                          getId={(item) => (item as unknown as { id: string }).id}
                          getLabel={(item) => item.name || ""}
                          getSearchText={(item) =>
                            `${item.name} ${item.description || ""}`
                          }
                          placeholder="Select rubric agent"
                          disabled={isReadonly}
                          multiSelect={false}
                          hideSelectedChips={true}
                          buttonClassName="w-full"
                          groupHeading="Agents"
                        />
                      ) : null}
                    </div>
                  );
                })()}

                {/* Active Switch */}
                <div className="space-y-2 pt-2">
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
                      checked={draftState.active}
                      onCheckedChange={(checked) =>
                        setDraftState((prev) => ({ ...prev, active: checked }))
                      }
                      disabled={isReadonly}
                      data-testid="switch-rubric-active"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Inactive rubrics will not be available for simulations
                  </p>
                </div>
              </div>
            </StepCard>
          );
        }

        case "groups": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <RubricStandardGroupCardGrid
                groups={draftState.standardGroups.map((g) => ({
                  id: g.id,
                  name: g.name,
                  description: g.description || "",
                  points: g.points || 5,
                  passPoints: g.passPoints || 4,
                  position: g.position || draftState.standardGroups.indexOf(g) + 1,
                  active: g.active ?? true,
                }))}
                onGroupsChange={handleStandardGroupsChange}
                readonly={isReadonly}
              />
            </StepCard>
          );
        }

        case "configuration": {
          if (draftState.standardGroups.length === 0) {
            return null;
          }

          return (
            <div className="space-y-4">
              {draftState.standardGroups.map((group, index) => {
                const groupStandards = draftState.standards.filter(
                  (s) => s.standardGroupId === group.id,
                );
                const hasStandards = groupStandards.length > 0;
                const actualStepStatus: StepStatus =
                  stepStatus === "pending"
                    ? "pending"
                    : !hasStandards
                      ? "active"
                      : "completed";

                return (
                  <RubricStandardSection
                    key={group.id}
                    group={group}
                    standards={draftState.standards}
                    gridCells={draftState.gridCells}
                    position={index + 1}
                    totalGroups={draftState.standardGroups.length}
                    onGroupChange={handleGroupChange}
                    onStandardsChange={(newStandards) =>
                      setDraftState((prev) => ({ ...prev, standards: newStandards }))
                    }
                    onGridCellChange={handleCellChange}
                    onAddStandard={handleAddStandard}
                    onRemoveStandard={handleRemoveStandard}
                    readonly={isReadonly}
                    stepStatus={actualStepStatus}
                    stepNumber={stepNumber + index}
                    isEditMode={isEditMode}
                  />
                );
              })}
            </div>
          );
        }

        case "preview": {
          if (draftState.standardGroups.length === 0 || draftState.standards.length === 0) {
            return null;
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              actions={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isReadonly || !draftState.rubricAgentId}
                  onClick={handleGenerateRubric}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              }
            >
              <div className="space-y-4">
                {/* Grid Table */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              colSpan={header.colSpan}
                              className={`border-r py-2 text-xs text-center ${
                                header.id === "group"
                                  ? "max-w-[200px] whitespace-normal"
                                  : ""
                              }`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className={`border-r px-3 py-2 ${
                                  cell.column.id === "group"
                                    ? "max-w-[200px] whitespace-normal"
                                    : ""
                                }`}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={table.getAllColumns().length}
                            className="h-24 text-center px-6"
                          >
                            No standard groups yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      draftState,
      isReadonly,
      isEditMode,
      rubricData,
      handleStandardGroupsChange,
      handleGroupChange,
      handleCellChange,
      handleAddStandard,
      handleRemoveStandard,
      handleGenerateRubric,
      table,
    ]
  );

  // Error state
  if (isEditMode && !rubricData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Not Found</h1>
          <p className="text-muted-foreground">
            The rubric you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={() => router.push("/engine/rubrics")}>
          Back to Rubrics
        </Button>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-page={`rubric-${isEditMode ? "edit" : "new"}`}
    >
      {/* Readonly warning */}
      {isReadonly && (
        <div className="bg-muted border border-border rounded-lg p-4">
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
                Rubric is read-only
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {rubricData?.department_ids?.length === 0
                  ? "This is a default rubric that cannot be edited."
                  : "This rubric cannot be edited."}
              </p>
            </div>
          </div>
        </div>
      )}

      <GenericForm
        nuqsParsers={
          rubricSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={urlParams}
        setFormData={setUrlParams}
        serverData={rubricData}
        initializeForm={initializeForm}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={renderStep}
      />
    </div>
  );
}
