/**
 * Personas.tsx
 * Used to display the personas page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { AlertCircle, Brain, Check, CheckCircle, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Sparkles, Trash2, Users, X } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SvgIcon } from "@/components/common/SvgIcon";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  PersonasListOut,
  PersonasListBody,
  CreatePersonaIn,
  CreatePersonaOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
} from "@/app/(main)/training/personas/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
import { useColumnVisibility } from "@/hooks/use-column-visibility";


// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export interface PersonasProps {
  // Server-provided data (for server-side rendering)
  listData: PersonasListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicatePersonaAction?: (
    input: DuplicatePersonaIn
  ) => Promise<DuplicatePersonaOut>;
  deletePersonaAction?: (input: DeletePersonaIn) => Promise<DeletePersonaOut>;
  createPersonaAction?: (input: CreatePersonaIn) => Promise<CreatePersonaOut>;
  updatePersonaAction?: (input: UpdatePersonaIn) => Promise<UpdatePersonaOut>;
  parseCsvAction?: ((formData: FormData) => Promise<ParseCsvResult>) | undefined;
  /** The body the page used for its SSR ``/persona/search`` call.
   *  Forwarded as the ``filter`` field on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: PersonasListBody;
  importFields?: ImportFieldDef[] | undefined;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  scenarioSearch: string;
  fieldSearch: string;
  departmentSearch: string;
  colorSearch: string;
  iconSearch: string;
  voiceSearch: string;
}

export default function Personas({
  listData: serverListData,
  initialColumnVisibility,
  duplicatePersonaAction,
  deletePersonaAction,
  createPersonaAction,
  updatePersonaAction,
  parseCsvAction,
  currentSearchBody,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  scenarioSearch,
  fieldSearch,
  departmentSearch,
  colorSearch,
  iconSearch,
  voiceSearch,
}: PersonasProps) {
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Excluded-
  // id growth is naturally bounded by what the user can see and
  // deselect (one page at a time), so we don't enforce a hard cap.
  // Shallow updates avoid the RSC re-fetch burst.
  const [selectedPersonaIds, setSelectedPersonaIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedPersonaIds, setExcludedPersonaIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null); // null = no change
  const [bulkEditColorIds, setBulkEditColorIds] = useState<string[]>([]); // empty = no change
  const [bulkEditIconIds, setBulkEditIconIds] = useState<string[]>([]); // empty = no change
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null); // null = no change
  const [bulkEditVoiceIds, setBulkEditVoiceIds] = useState<string[] | null>(null); // null = no change

  // Bulk import state
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);

  // ``usePersonaAi`` previously listened for ``persona.generate.completed``
  // and called ``router.refresh()`` so the list view updated after
  // generation. Removed — the audit framework already surfaces every
  // operation in the activity rail (so the user knows it happened),
  // and the duplicate-SSR-burst on every generate cycle was visible
  // noise. Newly-generated personas appear on next manual refresh
  // or when the user navigates back to this page.

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("personas", initialColumnVisibility);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize column filters from URL params
    const filters: ColumnFiltersState = [];
    const scenarioIds = searchParams?.getAll("scenarioIds") ?? [];
    const fieldIdParams = searchParams?.getAll("fieldIds") ?? [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    if (scenarioIds.length > 0) filters.push({ id: "scenarios", value: scenarioIds });
    if (fieldIdParams.length > 0) filters.push({ id: "fieldIds", value: fieldIdParams });
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Memoize personas data to prevent infinite re-renders
  const personasData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedPersonas`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const basePersonas = useMemo(() => {
    return personasData?.personas || [];
  }, [personasData?.personas]);

  const {
    ghosts: personaGhosts,
    mergedRows: mergedPersonas,
    ack: ackPersonaGhost,
    drop: _dropPersonaGhost,
  } = useArtifactGhosts({
    artifactType: "persona",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderPersonaCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: basePersonas,
    rowKey: "id",
    // ``personas`` plural is auto-derived as ``persona`` + "s" — kept
    // explicit here for clarity; matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_persona_list_rows``). The hook reads
    // ``output.personas`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    artifactPlural: "personas",
  });

  // Downstream code reads ``personas`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const personas = mergedPersonas;

  // Unified ack: live in-flight ghosts go through the hook (optimistic
  // overlay + ackOptimistic); server-side persistent pending rows
  // (synthesized below from ``persona.pending_status === "pending"``)
  // aren't in the hook's local state, so we ack them directly via the
  // generic server action and refresh. Same Accept/Reject button can
  // call this regardless of source.
  const handlePersonaAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = personaGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackPersonaGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "persona",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [personaGhosts, ackPersonaGhost, router],
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = personasData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedPersonaIds.includes(id)
        : selectedPersonaIds.includes(id);
    },
    [selectAllMatching, excludedPersonaIds, selectedPersonaIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedPersonaIds.length)
    : selectedPersonaIds.length;

  /** Selected rows that are loaded on the current page. Under all-
   *  matching mode this is "every loaded row not in excludedIds";
   *  under explicit mode it's the rows whose id is in selectedIds.
   *  Bulk-op handlers use ``resolveBulkIds`` (below) to expand to
   *  the full matching set under all-matching mode, but the loaded
   *  subset is what the toolbar's "X of Y" counts off-page. */
  const selectedPersonas = useMemo(() => {
    return personas.filter((p) => p.id && isSelected(p.id));
  }, [personas, isSelected]);

  const deletablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => p.can_delete);
  }, [selectedPersonas]);

  const nonDeletablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => !p.can_delete);
  }, [selectedPersonas]);

  const editablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => p.can_edit);
  }, [selectedPersonas]);

  // Check if all personas on the current page are selected. Under
  // all-matching mode every loaded row whose id isn't in
  // ``excludedPersonaIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = personas.filter((p) => p.id).map((p) => p.id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [personas, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > personas.length;

  // Toggle selection for a single persona. Under all-matching mode
  // we toggle membership in excludedPersonaIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedPersonaIds toggle.
  const toggleSelection = useCallback((personaId: string) => {
    if (selectAllMatching) {
      void setExcludedPersonaIds((prev) =>
        prev.includes(personaId)
          ? prev.filter((id) => id !== personaId)
          : [...prev, personaId],
      );
    } else {
      void setSelectedPersonaIds((prev) =>
        prev.includes(personaId)
          ? prev.filter((id) => id !== personaId)
          : [...prev, personaId],
      );
    }
  }, [selectAllMatching, setExcludedPersonaIds, setSelectedPersonaIds]);

  const clearSelection = useCallback(() => {
    void setSelectedPersonaIds([]);
    void setSelectAllMatching(false);
    void setExcludedPersonaIds([]);
  }, [setSelectedPersonaIds, setSelectAllMatching, setExcludedPersonaIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = personas.filter((p) => p.id).map((p) => p.id!);
    void setSelectAllMatching(false);
    void setExcludedPersonaIds([]);
    void setSelectedPersonaIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [personas, setSelectAllMatching, setExcludedPersonaIds, setSelectedPersonaIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedPersonaIds([]);
    void setExcludedPersonaIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedPersonaIds, setExcludedPersonaIds, setSelectAllMatching]);

  // Derive options from filter sections (server returns filtered options based on search)
  const scenarioOptions = useMemo(() => {
    return (personasData?.scenario_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.scenario_filter]);

  const fieldOptions = useMemo(() => {
    return (personasData?.field_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.field_filter]);

  const departmentOptions = useMemo(() => {
    return (personasData?.department_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.department_filter]);

  // Derive picker options from listData filter sections (for bulk edit dialog)
  const colorOptions = useMemo(() => {
    return (personasData?.color_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, hex_code: opt.hex_code ?? null }));
  }, [personasData?.color_filter]);

  const iconOptions = useMemo(() => {
    return (personasData?.icon_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, value: opt.value ?? null }));
  }, [personasData?.icon_filter]);

  const voiceOptions = useMemo(() => {
    return (personasData?.voice_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, voice: opt.name! }));
  }, [personasData?.voice_filter]);

  // Flag catalog (e.g. persona_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (personasData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [personasData?.flag_filter]);

  // Helper to update URL search params
  const updatePersonasParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      scenarioIds?: string[];
      fieldIds?: string[];
      departmentIds?: string[];
      scenarioSearch?: string;
      fieldSearch?: string;
      departmentSearch?: string;
      colorSearch?: string;
      iconSearch?: string;
      voiceSearch?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      if (updates.page !== undefined) {
        if (updates.page === 0) {
          params.delete("page");
        } else {
          params.set("page", updates.page.toString());
        }
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 12) {
          params.delete("pageSize");
        } else {
          params.set("pageSize", updates.pageSize.toString());
        }
      }

      if (updates.search !== undefined) {
        if (updates.search === "") {
          params.delete("search");
        } else {
          params.set("search", updates.search);
        }
      }

      if (updates.scenarioIds !== undefined) {
        params.delete("scenarioIds");
        updates.scenarioIds.forEach((id) => params.append("scenarioIds", id));
      }

      if (updates.fieldIds !== undefined) {
        params.delete("fieldIds");
        updates.fieldIds.forEach((id) => params.append("fieldIds", id));
      }

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.scenarioSearch !== undefined) {
        if (updates.scenarioSearch === "") {
          params.delete("scenarioSearch");
        } else {
          params.set("scenarioSearch", updates.scenarioSearch);
        }
      }

      if (updates.fieldSearch !== undefined) {
        if (updates.fieldSearch === "") {
          params.delete("fieldSearch");
        } else {
          params.set("fieldSearch", updates.fieldSearch);
        }
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") {
          params.delete("departmentSearch");
        } else {
          params.set("departmentSearch", updates.departmentSearch);
        }
      }

      if (updates.colorSearch !== undefined) {
        if (updates.colorSearch === "") {
          params.delete("colorSearch");
        } else {
          params.set("colorSearch", updates.colorSearch);
        }
      }

      if (updates.iconSearch !== undefined) {
        if (updates.iconSearch === "") {
          params.delete("iconSearch");
        } else {
          params.set("iconSearch", updates.iconSearch);
        }
      }

      if (updates.voiceSearch !== undefined) {
        if (updates.voiceSearch === "") {
          params.delete("voiceSearch");
        } else {
          params.set("voiceSearch", updates.voiceSearch);
        }
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updatePersonasParams({
        page: 0,
        search: value.trim() || "",
      });
    },
    [updatePersonasParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value === "") {
        commitSearch("");
        return;
      }

      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch]
  );

  // Handle search on blur or Enter
  const handleSearchBlur = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    commitSearch(searchTerm);
  }, [commitSearch, searchTerm]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        commitSearch(searchTerm);
      }
    },
    [commitSearch, searchTerm]
  );

  // Handle filter option search changes (debounced)
  const scenarioSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localScenarioSearch, setLocalScenarioSearch] = useState(scenarioSearch);
  const [localFieldSearch, setLocalFieldSearch] = useState(fieldSearch);
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [_localColorSearch, setLocalColorSearch] = useState(colorSearch);
  const [_localIconSearch, setLocalIconSearch] = useState(iconSearch);
  const [_localVoiceSearch, setLocalVoiceSearch] = useState(voiceSearch);

  const handleScenarioSearchChange = useCallback(
    (value: string) => {
      setLocalScenarioSearch(value);
      if (scenarioSearchTimeoutRef.current) {
        clearTimeout(scenarioSearchTimeoutRef.current);
      }
      scenarioSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ scenarioSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const handleFieldSearchChange = useCallback(
    (value: string) => {
      setLocalFieldSearch(value);
      if (fieldSearchTimeoutRef.current) {
        clearTimeout(fieldSearchTimeoutRef.current);
      }
      fieldSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ fieldSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) {
        clearTimeout(departmentSearchTimeoutRef.current);
      }
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ departmentSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const _handleColorSearchChange = useCallback(
    (value: string) => {
      setLocalColorSearch(value);
      if (colorSearchTimeoutRef.current) {
        clearTimeout(colorSearchTimeoutRef.current);
      }
      colorSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ colorSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const _handleIconSearchChange = useCallback(
    (value: string) => {
      setLocalIconSearch(value);
      if (iconSearchTimeoutRef.current) {
        clearTimeout(iconSearchTimeoutRef.current);
      }
      iconSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ iconSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const _handleVoiceSearchChange = useCallback(
    (value: string) => {
      setLocalVoiceSearch(value);
      if (voiceSearchTimeoutRef.current) {
        clearTimeout(voiceSearchTimeoutRef.current);
      }
      voiceSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ voiceSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      // Extract filter values
      const scenarioFilter = newFilters.find((f) => f.id === "scenarios");
      const fieldFilter = newFilters.find((f) => f.id === "fieldIds");
      const departmentFilter = newFilters.find((f) => f.id === "departments");

      updatePersonasParams({
        page: 0,
        scenarioIds: (scenarioFilter?.value as string[]) || [],
        fieldIds: (fieldFilter?.value as string[]) || [],
        departmentIds: (departmentFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updatePersonasParams]
  );

  // Handle pagination change
  const handlePaginationChange = useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      updatePersonasParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updatePersonasParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Define table columns
  const columns: ColumnDef<(typeof personas)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="font-medium">
              {persona.name || "Unnamed Persona"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {persona.description || "No description available"}
            </div>
          );
        },
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.scenario_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Fields (array of IDs)
      {
        id: "fieldIds",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.field_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("fieldIds") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
          const date = new Date(updatedAt);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Virtual columns for card view toggles
      {
        id: "ai_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.generated ?? false,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.description ?? "",
      },
      {
        id: "num_scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.num_scenarios ?? 0,
      },
      {
        id: "num_profiles",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.num_profiles ?? 0,
      },
    ];
  }, []);

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: personas,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
    pageCount,
  });

  // Memoize table rows. Including ``personas`` itself (not just
  // ``personas.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``personas`` is
  // stabilized upstream by ``mergedPersonas``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, personas, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deletePersonaAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deletePersonaAction({
        body: {
          ids: [deleteItem.id],
          all: false,
          accept: true,
        },
      });
      toast.success("Persona deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete persona";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete persona");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deletePersonaAction`` call shape; the
    // body just differs.
    if (!deletePersonaAction) return;
    if (!selectAllMatching && deletablePersonas.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const body = selectAllMatching
        ? {
            // Server resolves matching ids from the same filter the
            // page used (currentSearchBody is the SSR body), subtracts
            // ``excluded_ids``, then runs the existing per-row delete.
            // Per-row permission failures soft-skip — surfaced in
            // response.results[].
            all: true as const,
            excluded_ids: excludedPersonaIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            ids: deletablePersonas.map((p) => p.id!),
            accept: true,
          };

      const result = await deletePersonaAction({ body } as DeletePersonaIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeletePersonaOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} persona(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} persona(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete personas";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete personas");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updatePersonaAction) return;
    if (!selectAllMatching && editablePersonas.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    // Build the patch with only changed fields. Same shape under
    // both modes — explicit cloning per-row vs. server-side cloning
    // per matched id is the only difference.
    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasColorChange = bulkEditColorIds.length > 0;
    const hasIconChange = bulkEditIconIds.length > 0;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasVoiceChange = bulkEditVoiceIds !== null;
    const hasAnyFlagChange = hasActiveChange;

    if (!hasActiveChange && !hasColorChange && !hasIconChange && !hasDeptChange && !hasVoiceChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve flag UUIDs by type from the server-provided catalog.
    const flagId = (type: string) => flagOptions.find((f) => f.type === type)?.id;
    const activeFlagId = flagId("persona_active");

    setIsBulkEditing(true);
    try {
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side, preserving per-row flag
      // state for fields we aren't toggling.
      const sharedPatch = {
        ...(hasColorChange && { color_id: bulkEditColorIds[0] }),
        ...(hasIconChange && { icon_id: bulkEditIconIds[0] }),
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
        ...(hasVoiceChange && { voice_ids: bulkEditVoiceIds }),
      };

      let body: UpdatePersonaIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep. Other
        // flag types slot in here as the UI exposes them.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedPersonaIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdatePersonaIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editablePersonas.map((p) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !p.is_inactive;
            flag_ids = [];
            if (isActive && activeFlagId) flag_ids.push(activeFlagId);
          }
          return {
            id: p.id!,
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { personas: items } as UpdatePersonaIn["body"];
      }

      const result = await updatePersonaAction({ body } as UpdatePersonaIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdatePersonaOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} persona(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} persona(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update personas";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to update personas");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditColorIds([]);
    setBulkEditIconIds([]);
    setBulkEditDepartmentIds(null);
    setBulkEditVoiceIds(null);

    // Options come from listData filter sections — no lazy-load needed
    setShowBulkEditDialog(true);
  };

  const handleDuplicate = async (personaId: string, personaName: string) => {
    if (!duplicatePersonaAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(personaId);
    try {
      await duplicatePersonaAction({
        body: {
          id: personaId,
          accept: true,
        },
      });
      toast.success(`Persona "${personaName}" duplicated successfully`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate persona";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate persona");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const renderPersonaCard = (
    persona: (typeof personas)[0],
    ghost?: Ghost<(typeof personas)[0]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, icon styling, dimensions, badges.
    // Ghost mode swaps action buttons for a status badge (and Accept/
    // Reject for soft-pending), disables selection/click, and tints
    // the border based on lifecycle state. Avoids the prior banner
    // approach where the ghost was a full-width row that didn't match
    // the persona-card visual language.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    // Get the icon component from the persona's stored icon name
    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color
    const gradientStyle = generateGradientFromHex(hexColor);
    const iconColor = "#ffffff";

    const isSelected = !isGhost && persona.id
      ? selectedPersonaIds.includes(persona.id)
      : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (persona.id) {
        toggleSelection(persona.id);
      }
    };

    // Border tint reflects ghost lifecycle. ``animate-pulse`` while
    // in-flight signals "this is provisional"; failed/pending hold a
    // steady color so the user can decide.
    const ghostBorderClass = isFailed
      ? "border-destructive/40 bg-destructive/5"
      : isPending
      ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
      : ghostState === "deleting"
      ? "border-destructive/30 bg-destructive/5 opacity-70"
      : inFlight
      ? "border-primary/40 bg-primary/5 animate-pulse"
      : "";

    return (
      <Card
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${isSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "persona-ghost-card" : "persona-card"}
        data-persona-id={persona.id}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`persona card ${persona.name || (isGhost ? "Generating" : "Unnamed Persona")}`}
        aria-selected={isSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — inline before icon. Hidden in
                    ghost mode (no row id to select yet). */}
                {!isGhost && (
                  <div
                    className={`transition-all overflow-hidden flex-shrink-0 ${
                      selectedCount > 0 ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                    }`}
                    data-action-button
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        if (persona.id) toggleSelection(persona.id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select persona ${persona.name || "Unnamed"}`}
                    />
                  </div>
                )}
                <div
                  className="p-2 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0"
                  style={{
                    background: gradientStyle,
                  }}
                >
                  {/* In-flight ghost without a streamed icon yet → spinner.
                      Once partial/output carries the icon SVG, render it
                      via the same ``SvgIcon`` path. */}
                  {inFlight && !persona.icon ? (
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: iconColor }} />
                  ) : (
                    <SvgIcon
                      svg={persona.icon}
                      className="h-4 w-4"
                      style={{ color: iconColor }}
                      fallback={<Brain className="h-4 w-4" style={{ color: iconColor }} />}
                    />
                  )}
                </div>
                <CardTitle className="text-lg truncate">
                  {persona.name || (isGhost ? "Generating…" : "Unnamed Persona")}
                </CardTitle>
                {isGhost && (
                  <Badge
                    variant={isFailed ? "destructive" : isPending ? "outline" : "secondary"}
                    className={isPending ? "border-amber-500 text-amber-700 dark:text-amber-400" : ""}
                  >
                    {ghostState === "creating" && "Creating…"}
                    {ghostState === "duplicating" && "Duplicating…"}
                    {ghostState === "updating" && "Updating…"}
                    {ghostState === "deleting" && "Deleting…"}
                    {ghostState === "pending" && "Pending"}
                    {ghostState === "failed" && "Failed"}
                  </Badge>
                )}
              </div>
              {((columnVisibility.ai_badge !== false && persona.generated) || (columnVisibility.status_badge !== false && persona.is_inactive)) && (
                <div className="mt-1 flex items-center gap-2">
                  {columnVisibility.ai_badge !== false && persona.generated && (
                    <Badge variant="default">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {persona.mcp ? "MCP" : "AI"}
                    </Badge>
                  )}
                  {columnVisibility.status_badge !== false && persona.is_inactive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
              {/* Ghost-mode action area: status-aware. Pending → Accept/
                  Reject for soft-write ack. Failed → error indicator.
                  In-flight → no buttons (the streaming card is read-only
                  until commit/failure). */}
              {isGhost && isPending && ghost.callId && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="h-9 px-3"
                        onClick={() => handlePersonaAck(ghost.callId, true, ghost.op)}
                        aria-label="Accept pending persona"
                        data-action-button
                      >
                        <Check className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">Accept</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Accept</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        onClick={() => handlePersonaAck(ghost.callId, false, ghost.op)}
                        aria-label="Reject pending persona"
                        data-action-button
                      >
                        <X className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">Reject</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reject</TooltipContent>
                  </Tooltip>
                </>
              )}
              {isGhost && isFailed && ghost.error && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {ghost.error}
                </span>
              )}
              {!isGhost && persona.id && (<>{persona.can_edit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      data-testid="btn-edit-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      <HoverPrefetchLink
                        href={`/training/personas/${persona.id}`}
                        delay={150}
                        aria-label={`Edit persona ${persona.name || "Unnamed"}`}
                      >
                        <Edit className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">Edit</span>
                      </HoverPrefetchLink>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      data-testid="btn-view-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      <HoverPrefetchLink
                        href={`/training/personas/${persona.id}`}
                        delay={150}
                        aria-label={`View persona ${persona.name || "Unnamed"}`}
                      >
                        <Eye className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">View</span>
                      </HoverPrefetchLink>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View</TooltipContent>
                </Tooltip>
              )}
              {persona.can_duplicate && persona.id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (persona.id) {
                          handleDuplicate(
                            persona.id,
                            persona.name || "Unnamed Persona"
                          );
                        }
                      }}
                      disabled={isDuplicating === persona.id}
                      aria-busy={
                        isDuplicating === persona.id ? true : undefined
                      }
                      aria-label={`Duplicate persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-duplicate-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      {isDuplicating === persona.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 md:mr-0 mr-2" />
                      )}
                      <span className="md:hidden">
                        {isDuplicating === persona.id
                          ? "Duplicating..."
                          : "Duplicate"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate</TooltipContent>
                </Tooltip>
              )}
              {persona.can_delete && persona.id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (persona.id) {
                          handleDeleteClick(
                            persona.id,
                            persona.name || "Unnamed Persona"
                          );
                        }
                      }}
                      aria-label={`Delete persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-delete-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              )}</>)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          {columnVisibility.card_description !== false && (
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
              {persona.description || "No description available"}
            </p>
          )}
          {(columnVisibility.num_scenarios !== false || columnVisibility.num_profiles !== false) && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              {columnVisibility.num_scenarios !== false && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {persona.num_scenarios} {persona.num_scenarios === 1 ? "scenario" : "scenarios"}
                </span>
              )}
              {columnVisibility.num_scenarios !== false && columnVisibility.num_profiles !== false && (
                <span className="text-muted-foreground">&middot;</span>
              )}
              {columnVisibility.num_profiles !== false && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {persona.num_profiles ?? 0} {persona.num_profiles === 1 ? "profile" : "profiles"}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const scenarioColumn = table.getColumn("scenarios");
  const fieldColumn = table.getColumn("fieldIds");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8" data-page="personas-index">
        <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div className="space-y-2" data-testid="personas-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deletePersonaAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletablePersonas.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletablePersonas.length} of ${selectedCount}`}
                </Button>
              )}
              {updatePersonaAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editablePersonas.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editablePersonas.length} of ${selectedCount}`}
                </Button>
              )}
              {!allPageSelected && !selectAllMatching && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={selectAllOnPage}
                >
                  Select Page
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={clearSelection}
              >
                Unselect All
              </Button>
            </div>
            <DataTableViewOptions table={table} hiddenColumns={["name", "description", "scenarios", "fieldIds", "departments", "updated_at"]} />
          </div>

          {/* Cross-page selection banners. Two states:
              (a) page-all selected, more matching elsewhere → offer
                  "Select all N matching" to flip into all-matching mode.
              (b) all-matching active → show count + Clear so the
                  user always has an obvious escape hatch.
              Mutually exclusive — both never render at once. */}
          {!selectAllMatching && allPageSelected && hasMoreThanCurrentPage && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              data-testid="select-all-matching-banner"
            >
              <span className="text-muted-foreground">
                All {personas.length} on this page selected.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={selectAllMatchingNow}
              >
                Select all {totalMatchingCount} matching
              </Button>
            </div>
          )}
          {selectAllMatching && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm"
              data-testid="all-matching-active-banner"
            >
              <span className="text-muted-foreground">
                All {selectedCount} matching personas selected
                {excludedPersonaIds.length > 0 && ` (${excludedPersonaIds.length} excluded)`}.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={clearSelection}
              >
                Clear
              </Button>
            </div>
          )}
          </div>
        ) : (
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="personas-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="personas-search"
                  placeholder="Search personas..."
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onBlur={handleSearchBlur}
                  onKeyDown={handleSearchKeyDown}
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search personas by name"
                  aria-controls="personas-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    {
                      column: scenarioColumn,
                      title: "Scenario",
                      options: scenarioOptions,
                      isServerDriven: true,
                      onSearchChange: handleScenarioSearchChange,
                      searchValue: localScenarioSearch,
                    },
                    {
                      column: fieldColumn,
                      title: "Field",
                      options: fieldOptions,
                      isServerDriven: true,
                      onSearchChange: handleFieldSearchChange,
                      searchValue: localFieldSearch,
                    },
                    {
                      column: departmentsColumn,
                      title: "Department",
                      options: departmentOptions,
                      isServerDriven: true,
                      onSearchChange: handleDepartmentSearchChange,
                      searchValue: localDepartmentSearch,
                    },
                  ]}
                />

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchTerm("");
                      setLocalScenarioSearch("");
                      setLocalFieldSearch("");
                      setLocalDepartmentSearch("");
                      setLocalColorSearch("");
                      setLocalIconSearch("");
                      setLocalVoiceSearch("");
                      table.resetColumnFilters();
                      updatePersonasParams({
                        page: 0,
                        search: "",
                        scenarioIds: [],
                        fieldIds: [],
                        departmentIds: [],
                        scenarioSearch: "",
                        fieldSearch: "",
                        departmentSearch: "",
                        colorSearch: "",
                        iconSearch: "",
                        voiceSearch: "",
                      });
                    }}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {parseCsvAction && importFields && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkImportDialog(true)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              )}
              <DataTableViewOptions table={table} hiddenColumns={["name", "description", "scenarios", "fieldIds", "departments", "updated_at"]} />
            </div>
          </div>
        )}

        {/* Cards Grid — container-query driven so it scales to available width
            (e.g. when the right AI panel opens, the grid drops a column smoothly
            rather than waiting on a viewport breakpoint).
            Note: @container must be on a PARENT — the @ modifiers query the
            nearest ancestor with container-type, not the element itself.

            Ghost cards from in-flight audited writes (create/duplicate/
            update/delete in non-terminal states) are prepended — same
            ``renderPersonaCard`` so layout, dimensions, and visual
            language match exactly. Once a ghost commits, its hydrated
            row is in ``mergedRows`` (via ``state.added``) AND the
            ghost's ``state`` flips to "committed" — we filter those
            out so the real row replaces the ghost in place without a
            duplicate frame. */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="personas grid"
            data-testid="personas-grid"
          >
          {personaGhosts
            .filter((g) => g.state !== "committed" && g.state !== "accepted")
            .map((g) => {
              // For update/delete, ``before`` is the snapshot lookup
              // from baseRows (existing row) — gives us icon, name,
              // description so the ghost card shows what's being
              // deleted/updated. For create/duplicate, ``before`` is
              // null and ``partial`` carries the streaming args
              // (often sparse for duplicate, richer for create).
              const personaShell = (g.before ?? g.partial) as (typeof personas)[0];
              return (
                <div key={`ghost-${g.callId}`}>
                  {renderPersonaCard(personaShell, g)}
                </div>
              );
            })}
          {tableRows.length ? (
            tableRows.map((row) => {
              const persona = row.original;
              const key = persona.id || `persona-${row.id}`;
              // Server-side pending status (from soft_calls_mv) — render
              // the row as a pending ghost so Accept/Reject controls
              // appear and the persona-card visual reflects the dormant
              // state. Live in-flight ghosts continue to come from the
              // audit hub (rendered above this block).
              const persistentGhost: Ghost<(typeof personas)[0]> | undefined =
                persona.pending_status === "pending" && persona.pending_call_id
                  ? {
                      callId: persona.pending_call_id,
                      op: (persona.pending_operation as Ghost<(typeof personas)[0]>["op"]) ?? "create",
                      state: "pending",
                      rowId: persona.id ?? null,
                      partial: persona as unknown as Ghost<(typeof personas)[0]>["partial"],
                      before: persona,
                      tool: null,
                      error: null,
                      arguments: {},
                    }
                  : undefined;
              return (
                <div key={key}>
                  {renderPersonaCard(persona, persistentGhost)}
                </div>
              );
            })
          ) : (
            personaGhosts.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No personas match the current filters.
              </div>
            )
          )}
          </div>
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-persona-title"
          data-testid="dialog-delete-persona"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-persona-title">
              Delete Persona
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the persona "{deleteItem?.name}
              "? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              data-testid="btn-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              data-testid="btn-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectAllMatching ? selectedCount : deletablePersonas.length}
        entityLabel="persona"
        entityLabelPlural="personas"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {selectAllMatching ? (
              // All-matching mode: server resolves rows from filter +
              // exclusions; per-row permission failures soft-skip.
              // We can't enumerate names without round-tripping through
              // the search endpoint (which would re-trigger the RSC
              // burst), so show the count + filter state instead.
              <div className="text-sm text-muted-foreground">
                <p>
                  All <span className="font-medium text-foreground">{selectedCount}</span> matching
                  {" "}personas will be deleted server-side using the current filter.
                </p>
                {excludedPersonaIds.length > 0 && (
                  <p className="mt-1">
                    {excludedPersonaIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Personas you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletablePersonas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletablePersonas.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {p.name || "Unnamed Persona"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletablePersonas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use by scenarios):</p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletablePersonas.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                          {p.name || "Unnamed Persona"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={selectAllMatching ? selectedCount : editablePersonas.length}
        entityLabelPlural="personas"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        {/* Active status — tri-state flag field */}
        <BulkEditFlagField
          label="Active Status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />

        {/* Color — GenericPicker single-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <GenericPicker
                items={colorOptions}
                selectedIds={bulkEditColorIds}
                onSelect={setBulkEditColorIds}
                getId={(c) => c.id}
                getLabel={(c) => c.name}
                placeholder="No change"
                showClearAction
                clearActionLabel="No change"
                searchPlaceholder="Search colors..."
                emptyMessage="No colors found."
                groupHeading="Colors"
                renderItem={(c, isSelected) => (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {c.hex_code && (
                        <span
                          className="inline-block h-3 w-3 rounded-full border flex-shrink-0"
                          style={{ backgroundColor: c.hex_code }}
                        />
                      )}
                      <span className="truncate">{c.name}</span>
                    </div>
                    <Check className={`ml-auto flex-shrink-0 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                  </div>
                )}
              />
            </div>

            {/* Icon — GenericPicker single-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Icon</Label>
              <GenericPicker
                items={iconOptions}
                selectedIds={bulkEditIconIds}
                onSelect={setBulkEditIconIds}
                getId={(ic) => ic.id}
                getLabel={(ic) => ic.name}
                placeholder="No change"
                showClearAction
                clearActionLabel="No change"
                searchPlaceholder="Search icons..."
                emptyMessage="No icons found."
                groupHeading="Icons"
                renderItem={(ic, isSelected) => {
                  return (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <SvgIcon svg={ic.value || ic.name} className="h-4 w-4 flex-shrink-0" fallback={<Brain className="h-4 w-4 flex-shrink-0" />} />
                        <span className="truncate">{ic.name}</span>
                      </div>
                      <Check className={`ml-auto flex-shrink-0 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                    </div>
                  );
                }}
              />
            </div>

            {/* Departments — GenericPicker multi-select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Departments</Label>
                {bulkEditDepartmentIds !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setBulkEditDepartmentIds(null)}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {bulkEditDepartmentIds === null ? (
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setBulkEditDepartmentIds([])}
                >
                  No change — click to edit departments
                </Button>
              ) : (
                <GenericPicker
                  items={departmentOptions}
                  selectedIds={bulkEditDepartmentIds}
                  onSelect={setBulkEditDepartmentIds}
                  multiSelect
                  getId={(d) => d.value}
                  getLabel={(d) => d.label}
                  placeholder="Select departments..."
                  showClearAction
                  clearActionLabel="Clear All"
                  searchPlaceholder="Search departments..."
                  emptyMessage="No departments found."
                  groupHeading="Departments"
                  hideSelectedChips={false}
                  showClearAll
                />
              )}
            </div>

            {/* Voices — GenericPicker multi-select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Voices</Label>
                {bulkEditVoiceIds !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setBulkEditVoiceIds(null)}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {bulkEditVoiceIds === null ? (
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setBulkEditVoiceIds([])}
                >
                  No change — click to edit voices
                </Button>
              ) : (
                <GenericPicker
                  items={voiceOptions}
                  selectedIds={bulkEditVoiceIds}
                  onSelect={setBulkEditVoiceIds}
                  multiSelect
                  getId={(v) => v.id}
                  getLabel={(v) => v.voice}
                  placeholder="Select voices..."
                  showClearAction
                  clearActionLabel="Clear All"
                  searchPlaceholder="Search voices..."
                  emptyMessage="No voices found."
                  groupHeading="Voices"
                  hideSelectedChips={false}
                  showClearAll
                />
              )}
            </div>
      </BulkEditDialog>

      {/* Bulk Import Dialog */}
      {parseCsvAction && importFields && (
        <BulkImport
          open={showBulkImportDialog}
          onClose={() => {
            setShowBulkImportDialog(false);
            router.refresh();
          }}
          fields={importFields}
          artifactName="Personas"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createPersonaAction) throw new Error("Create action not available");
            const personas = items.map((item) => ({
              name: item.name as string | undefined,
              description: item.description as string | undefined,
              color: item.color as string | undefined,
              icon: item.icon as string | undefined,
              instructions: item.instructions as string | undefined,
              active: item['active_flag'] as boolean | undefined,
              departments: item.departments as string[] | undefined,
              parameter_fields: item.parameter_fields as string[] | undefined,
              examples: item.examples as string[] | undefined,
              voices: item.voices as string[] | undefined,
            }));
            return createPersonaAction({ body: { personas } } as CreatePersonaIn);
          }}
        />
      )}

      </div>
    </TooltipProvider>
  );
}
