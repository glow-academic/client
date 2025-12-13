/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// UI Components
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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// TanStack Table
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

// Import types from new page (create action)
import type {
  CohortNewOut,
  CreateCohortIn,
  CreateCohortOut,
} from "@/app/(main)/create/cohorts/new/page";
// Import types from edit page (update action)
import type {
  CohortDetailOut,
  UpdateCohortIn,
  UpdateCohortOut,
} from "@/app/(main)/create/cohorts/c/[cohortId]/page";
import type { ProfileListItem } from "@/app/(main)/management/staff/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Power,
  RefreshCw,
  Search,
  User as UserIcon,
  UserMinus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Helper functions for staff table
const getInitials = (firstName: string, lastName: string): string => {
  if (!firstName && !lastName) return "??";
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "??";
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
    case "instructional":
      return UserIcon;
    case "member":
    case "guest":
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case "superadmin":
      return "Super Administrator";
    case "admin":
      return "Administrator";
    case "instructional":
      return "Instructional Staff";
    case "member":
      return "Member";
    case "guest":
      return "Guest";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const formatLastActive = (timestamp: string | null): string => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  );

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
};

// Helper to normalize cohort staff item to ProfileListItem format
type ProfileListItemWithRemove = ProfileListItem & {
  can_remove?: boolean;
  isStaged?: boolean;
};

const normalizeCohortStaffItem = (
  item: CohortDetailOut["staff"][number] | CohortNewOut["staff"][number]
): ProfileListItemWithRemove => {
  return {
    profile_id: item.profile_id,
    first_name: item.first_name,
    last_name: item.last_name,
    emails: item.emails || [],
    primary_email: item.primary_email || "",
    name: item.name,
    role: item.role,
    initials: item.initials,
    active: item.active,
    last_active: item.lastActive ?? null,
    cohort_ids: item.cohort_ids ?? [],
    department_ids: item.department_ids ?? [],
    primary_department_id: item.primary_department_id,
    requests_per_day: item.requests_per_day ?? null,
    total_requests: item.total_requests ?? 0,
    requests_in_last_day: item.requests_in_last_day ?? 0,
    can_edit: item.can_edit,
    can_delete: item.can_delete,
    can_remove: "can_remove" in item ? item.can_remove : false,
  };
};

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortDetail?: CohortDetailOut;
  cohortDetailDefault?: CohortNewOut;
  // Server actions (replaces useMutation)
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
  // Add-staff search function (search-only, no mutation - profiles are staged and sent in update)
  searchAddStaff?: (input: {
    body: {
      cohortId: string | null;
      query: string | null;
      departmentIds: string[] | null;
      limit: number;
      profileId: string;
    };
  }) => Promise<{
    staff: ProfileListItem[];
    cohort_mapping: Record<string, { name: string; description: string }>;
    department_mapping: Record<string, { name: string; description: string }>;
  }>;
}

interface FormErrors {
  title?: string;
}
interface FormData {
  title: string;
  description: string;
  active: boolean;
  departmentIds: string[] | null;
}

export default function Cohort({
  cohortId,
  cohortDetail: serverCohortDetail,
  cohortDetailDefault: serverCohortDetailDefault,
  createCohortAction,
  updateCohortAction,
  searchAddStaff,
}: CohortProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedSimulation, setDraggedSimulation] = useState<string | null>(
    null
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!cohortId;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = {
    title: "",
    description: "",
    active: true,
    departmentIds: defaultDepartmentIds,
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Staff management state
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false);
  // Simplified staging - just track profile IDs
  const [stagedProfileIdsToAdd, setStagedProfileIdsToAdd] = useState<string[]>(
    []
  );
  const [stagedProfileIdsToRemove, setStagedProfileIdsToRemove] = useState<
    string[]
  >([]);
  // Staff search modal state
  const [showStaffSearchModal, setShowStaffSearchModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffSearchResults, setStaffSearchResults] = useState<
    ProfileListItem[]
  >([]);
  const [staffSearchSelectedIds, setStaffSearchSelectedIds] = useState<
    Set<string>
  >(new Set());
  const [staffSearchSelectedProfiles, setStaffSearchSelectedProfiles] =
    useState<Map<string, ProfileListItem>>(new Map());
  const [isSearchingStaff, setIsSearchingStaff] = useState(false);
  const staffSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation active state management (staged changes)
  const [simulationActiveStates, setSimulationActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalSimulationActiveStates, setOriginalSimulationActiveStates] =
    useState<Record<string, boolean>>({});

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const cohortDetail = serverCohortDetail;
  const cohortDetailDefault = serverCohortDetailDefault;

  // Use edit detail when editing, default detail when creating
  const cohortData = isEditMode ? cohortDetail : cohortDetailDefault;

  // Set breadcrumb context when cohort data is loaded
  useEffect(() => {
    if (cohortDetail?.title && cohortId && isEditMode) {
      setEntityMetadata({
        entityId: cohortId,
        entityName: cohortDetail.title,
        entityType: "cohort",
      });
    }
    return () => clearEntityMetadata();
  }, [
    cohortDetail,
    cohortId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types for type safety
  type CreateCohortBody = CreateCohortIn extends { body: infer B } ? B : never;
  type UpdateCohortBody = UpdateCohortIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreateCohort = async (body: CreateCohortBody) => {
    if (!createCohortAction) {
      throw new Error("createCohortAction is required");
    }
    await createCohortAction({ body });
  };

  const handleUpdateCohort = async (body: UpdateCohortBody) => {
    if (!updateCohortAction) {
      throw new Error("updateCohortAction is required");
    }
    await updateCohortAction({ body });
  };

  // State for junction data
  const [currentSimulationIds, setCurrentSimulationIds] = useState<string[]>(
    []
  );

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !cohortData) return false;
    return !cohortData.can_edit;
  }, [isEditMode, cohortData]);

  // Filter valid IDs based on selected departments
  const departmentMapping = useMemo(
    () => cohortData?.department_mapping || {},
    [cohortData?.department_mapping]
  );

  const validSimulationIds = useMemo(() => {
    const baseIds = cohortData?.valid_simulation_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of simulation_ids from selected departments
    const deptSimulationIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.simulation_ids && Array.isArray(deptData.simulation_ids)) {
        deptData.simulation_ids.forEach((id) => deptSimulationIds.add(id));
      }
    });

    // Filter base IDs to only include those in department simulation IDs
    return baseIds.filter((id) => deptSimulationIds.has(id));
  }, [
    cohortData?.valid_simulation_ids,
    formData?.departmentIds,
    departmentMapping,
  ]);

  // Role options from scopedRoles
  const roleOptions = useMemo(() => {
    const roleLabels: Record<string, string> = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      instructional: "Instructional Staff",
      member: "Member",
      guest: "Guest",
    };
    return (scopedRoles || []).map((role) => ({
      value: role,
      label: roleLabels[role] || role,
    }));
  }, [scopedRoles]);

  // Handle simulation selection from picker (V2 uses IDs directly)
  const handleSimulationSelection = useCallback((simulationIds: string[]) => {
    setCurrentSimulationIds(simulationIds);
  }, []);

  // Load cohort data from V2 API response
  useEffect(() => {
    if (cohortData && isEditMode) {
      const deptIds = cohortData.department_ids || [];
      const cohortFormData = {
        title: cohortData.title || "",
        description: cohortData.description || "",
        active: cohortData.active ?? true,
        departmentIds: deptIds,
      };

      // Only update if the data has actually changed to prevent infinite loops
      setFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(cohortFormData.departmentIds?.sort());

        return hasChanged ? cohortFormData : prev;
      });

      setOriginalFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(cohortFormData.departmentIds?.sort());

        return hasChanged ? cohortFormData : prev;
      });

      // Load simulation IDs
      setCurrentSimulationIds((prev) => {
        const newIds = cohortData.simulation_ids;
        const hasChanged =
          JSON.stringify(prev.sort()) !== JSON.stringify(newIds.sort());
        return hasChanged ? newIds : prev;
      });

      // Initialize simulation active states from server data
      if (cohortData.simulations) {
        const activeStates: Record<string, boolean> = {};
        cohortData.simulations.forEach((sim) => {
          activeStates[sim.simulation_id] = sim.active;
        });
        setSimulationActiveStates(activeStates);
        setOriginalSimulationActiveStates(activeStates);
      }
    }
  }, [cohortData, isEditMode]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original simulation IDs from cohortData
    const originalSimulationIds = cohortData?.simulation_ids || [];

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify([...currentSimulationIds].sort()) !==
        JSON.stringify(originalSimulationIds.sort()) ||
      JSON.stringify(simulationActiveStates) !==
        JSON.stringify(originalSimulationActiveStates) ||
      stagedProfileIdsToAdd.length > 0 ||
      stagedProfileIdsToRemove.length > 0
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentSimulationIds,
    cohortData?.simulation_ids,
    simulationActiveStates,
    originalSimulationActiveStates,
    stagedProfileIdsToAdd.length,
    stagedProfileIdsToRemove.length,
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Simulation management handlers
  const removeSimulation = (simulationId: string) => {
    setCurrentSimulationIds((prev) => prev.filter((id) => id !== simulationId));
  };

  const handleDragStartSimulation = (
    e: React.DragEvent,
    simulationId: string
  ) => {
    setDraggedSimulation(simulationId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSimulationId: string) => {
    e.preventDefault();

    if (!draggedSimulation) return;

    const newOrder = [...currentSimulationIds];
    const draggedIndex = newOrder.findIndex((id) => id === draggedSimulation);
    const targetIndex = newOrder.findIndex((id) => id === targetSimulationId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      const insertIndex =
        draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newOrder.splice(insertIndex, 0, removed!);

      setCurrentSimulationIds(newOrder);
    }

    setDraggedSimulation(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = "Title is required";
    }

    // For instructional users, ensure they are always in the cohort
    if (effectiveProfile?.role === "instructional" && !isEditMode) {
      const existingProfileIds =
        cohortData?.staff?.map((s) => s.profile_id) || [];
      const finalProfileIds = [
        ...existingProfileIds.filter(
          (id) => !stagedProfileIdsToRemove.includes(id)
        ),
        ...stagedProfileIdsToAdd.filter(
          (id) => !existingProfileIds.includes(id)
        ),
      ];
      const isUserInCohort = finalProfileIds.includes(effectiveProfile.id);
      if (!isUserInCohort) {
        newErrors.title = "You must be included in the cohort to create it";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setEditingCohortId(null);
    setErrors({});
    setSelectedStaffIds([]);
    setStagedProfileIdsToAdd([]);
    setStagedProfileIdsToRemove([]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Compute final profile_ids array: existing - removals + additions
      const existingProfileIds =
        cohortId && cohortData?.staff
          ? cohortData.staff.map((s) => s.profile_id)
          : [];
      const finalProfileIds = [
        ...existingProfileIds.filter(
          (id) => !stagedProfileIdsToRemove.includes(id)
        ),
        ...stagedProfileIdsToAdd.filter(
          (id) => !existingProfileIds.includes(id)
        ),
      ];

      const validDepartmentIds = cohortData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        // UPDATE mode
        const updateRequest: UpdateCohortBody = {
          cohortId: targetCohortId,
          title: formData.title || "",
          description: formData.description || null,
          department_ids: finalDepartmentIds || [],
          active: formData.active ?? true,
          simulation_ids: currentSimulationIds,
          profile_ids: finalProfileIds,
        };
        await handleUpdateCohort(updateRequest);

        toast.success("Cohort updated successfully!");
        // Clear staged profiles after successful update
        setStagedProfileIdsToAdd([]);
        setStagedProfileIdsToRemove([]);
      } else {
        // CREATE mode
        const createRequest: CreateCohortBody = {
          title: formData.title || "",
          description: formData.description || null,
          department_ids: finalDepartmentIds || [],
          active: formData.active || true,
          simulation_ids: currentSimulationIds,
          profile_ids: finalProfileIds,
        };
        await handleCreateCohort(createRequest);

        toast.success("Cohort created successfully!");
        // Clear staged profiles after successful create
        setStagedProfileIdsToAdd([]);
        setStagedProfileIdsToRemove([]);
      }

      resetFormAndState();
      router.push(`/create/cohorts`);
    } catch (error) {
      const targetCohortId = cohortId || editingCohortId;
      toast.error(
        `Failed to ${targetCohortId ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClick = () => {
    handleSubmit();
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateClick();
  };

  const editSimulation = (simulationId: string) => {
    window.open(`/create/simulations/s/${simulationId}`, "_blank");
  };

  // Staff search functionality
  const handleStaffSearch = useCallback(
    async (query: string) => {
      if (!effectiveProfile?.id || !searchAddStaff) {
        setIsSearchingStaff(false);
        return;
      }
      setIsSearchingStaff(true);
      try {
        const normalizedQuery = query && query.trim() ? query.trim() : null;
        const data = await searchAddStaff({
          body: {
            cohortId: cohortId || null,
            query: normalizedQuery,
            departmentIds: formData.departmentIds || null,
            limit: 200,
            profileId: effectiveProfile.id,
          },
        });
        setStaffSearchResults(data.staff);
      } catch {
        toast.error("Failed to search staff");
        setStaffSearchResults([]);
      } finally {
        setIsSearchingStaff(false);
      }
    },
    [effectiveProfile?.id, searchAddStaff, cohortId, formData.departmentIds]
  );

  const handleStaffSearchQueryChange = useCallback(
    (value: string) => {
      setStaffSearchQuery(value);
      if (staffSearchTimeoutRef.current) {
        clearTimeout(staffSearchTimeoutRef.current);
      }
      if (value === "") {
        setStaffSearchResults([]);
        setIsSearchingStaff(false);
        return;
      }
      setIsSearchingStaff(true);
      staffSearchTimeoutRef.current = setTimeout(() => {
        handleStaffSearch(value);
      }, 500);
    },
    [handleStaffSearch]
  );

  // Track previous department IDs to detect actual changes
  const prevDepartmentIdsRef = useRef<string[] | null>(null);
  const modalInitializedRef = useRef(false);

  // Initial search when modal opens (only once per modal open)
  useEffect(() => {
    if (
      showStaffSearchModal &&
      !modalInitializedRef.current &&
      searchAddStaff &&
      effectiveProfile?.id
    ) {
      // Initialize refs when modal opens
      const currentDeptIds = formData.departmentIds || null;
      prevDepartmentIdsRef.current = currentDeptIds;
      modalInitializedRef.current = true;

      // Do initial search (inline to avoid dependency on handleStaffSearch)
      setIsSearchingStaff(true);
      searchAddStaff({
        body: {
          cohortId: cohortId || null,
          query: null,
          departmentIds: currentDeptIds,
          limit: 200,
          profileId: effectiveProfile.id,
        },
      })
        .then((data) => {
          setStaffSearchResults(data.staff);
        })
        .catch(() => {
          toast.error("Failed to search staff");
          setStaffSearchResults([]);
        })
        .finally(() => {
          setIsSearchingStaff(false);
        });
    } else if (!showStaffSearchModal) {
      // Reset initialization flag when modal closes
      modalInitializedRef.current = false;
      prevDepartmentIdsRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showStaffSearchModal,
    searchAddStaff,
    effectiveProfile?.id,
    cohortId,
    // formData.departmentIds intentionally excluded - we read it directly in the effect
    // to avoid triggering re-runs when departments change (handled by second useEffect)
  ]);

  // Re-search when department selection changes while modal is open
  useEffect(() => {
    if (
      showStaffSearchModal &&
      !isSearchingStaff &&
      searchAddStaff &&
      effectiveProfile?.id
    ) {
      const currentDeptIds = formData.departmentIds || null;
      const prevDeptIds = prevDepartmentIdsRef.current;

      // Only trigger if department IDs actually changed
      const deptIdsChanged =
        JSON.stringify(currentDeptIds?.sort()) !==
        JSON.stringify(prevDeptIds?.sort());

      if (deptIdsChanged) {
        // Update ref before triggering search
        prevDepartmentIdsRef.current = currentDeptIds;

        // Debounce the re-search to avoid too many calls
        const timeoutId = setTimeout(async () => {
          if (!searchAddStaff || !effectiveProfile?.id) return;
          setIsSearchingStaff(true);
          try {
            const normalizedQuery =
              staffSearchQuery && staffSearchQuery.trim()
                ? staffSearchQuery.trim()
                : null;
            const data = await searchAddStaff({
              body: {
                cohortId: cohortId || null,
                query: normalizedQuery,
                departmentIds: currentDeptIds,
                limit: 200,
                profileId: effectiveProfile.id,
              },
            });
            setStaffSearchResults(data.staff);
          } catch {
            toast.error("Failed to search staff");
            setStaffSearchResults([]);
          } finally {
            setIsSearchingStaff(false);
          }
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
    return undefined;
  }, [
    formData.departmentIds,
    showStaffSearchModal,
    isSearchingStaff,
    searchAddStaff,
    effectiveProfile?.id,
    staffSearchQuery,
    cohortId,
  ]);

  // Reset state when modal closes
  useEffect(() => {
    if (!showStaffSearchModal) {
      setStaffSearchQuery("");
      setStaffSearchSelectedIds(new Set());
      setStaffSearchSelectedProfiles(new Map());
      setIsSearchingStaff(false);
    }
  }, [showStaffSearchModal]);

  // Toggle profile selection in search modal
  const handleToggleProfile = useCallback((profile: ProfileListItem) => {
    const profileId = profile.profile_id;
    setStaffSearchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
        setStaffSearchSelectedProfiles((prevProfiles) => {
          const nextProfiles = new Map(prevProfiles);
          nextProfiles.delete(profileId);
          return nextProfiles;
        });
      } else {
        next.add(profileId);
        setStaffSearchSelectedProfiles((prevProfiles) => {
          const nextProfiles = new Map(prevProfiles);
          nextProfiles.set(profileId, profile);
          return nextProfiles;
        });
      }
      return next;
    });
  }, []);

  const handleAddSelectedStaff = () => {
    if (staffSearchSelectedIds.size === 0) {
      toast.error("Please select at least one profile.");
      return;
    }

    const selectedProfilesArray = Array.from(
      staffSearchSelectedProfiles.values()
    );
    if (selectedProfilesArray.length === 0) {
      toast.error("No profiles selected.");
      return;
    }

    const newIds = Array.from(staffSearchSelectedIds);
    setStagedProfileIdsToAdd((prev) => {
      const combined = new Set([...prev, ...newIds]);
      return Array.from(combined);
    });
    setShowStaffSearchModal(false);
    setStaffSearchQuery("");
    setStaffSearchSelectedIds(new Set());
    setStaffSearchSelectedProfiles(new Map());
    setStaffSearchResults([]);
    toast.success(
      `${selectedProfilesArray.length} profile(s) staged. They will be added when you click Update.`
    );
  };

  // Prepare staff data for table display
  const staffDataForTable = useMemo(() => {
    if (!cohortId || !cohortData) return [];

    const existingStaff = cohortData.staff || [];
    const existingStaffIds = new Set(existingStaff.map((s) => s.profile_id));

    // Filter out staged removals
    const filteredExistingStaff = existingStaff.filter(
      (s) => !stagedProfileIdsToRemove.includes(s.profile_id)
    );

    // Get staged profiles from search results (if available) or create minimal entries
    const stagedProfiles: ProfileListItemWithRemove[] = stagedProfileIdsToAdd
      .filter((id) => !existingStaffIds.has(id))
      .map((id) => {
        // Try to find in search results
        const found = staffSearchResults.find((p) => p.profile_id === id);
        if (found) {
          return {
            ...found,
            can_remove: true,
            isStaged: true,
          };
        }
        // Create minimal entry
        return {
          profile_id: id,
          first_name: "",
          last_name: "",
          emails: [],
          primary_email: "",
          name: "Loading...",
          role: "member",
          initials: "??",
          active: true,
          last_active: null,
          cohort_ids: cohortId ? [cohortId] : [],
          department_ids: formData.departmentIds || [],
          primary_department_id: (formData.departmentIds?.[0] || "") as string,
          requests_per_day: null,
          total_requests: 0,
          requests_in_last_day: 0,
          can_edit: false,
          can_delete: false,
          can_remove: true,
          isStaged: true,
        };
      });

    // Normalize existing staff
    const normalizedExistingStaff = filteredExistingStaff.map(
      normalizeCohortStaffItem
    );

    return [...stagedProfiles, ...normalizedExistingStaff];
  }, [
    cohortId,
    cohortData,
    stagedProfileIdsToAdd,
    stagedProfileIdsToRemove,
    staffSearchResults,
    formData.departmentIds,
  ]);

  // Staff table columns
  const staffColumns = useMemo<ColumnDef<ProfileListItemWithRemove>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="pr-2">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => {
                table.toggleAllPageRowsSelected(!!value);
                const visibleRowIds = table
                  .getFilteredRowModel()
                  .rows.map((row) => row.original.profile_id);
                if (value) {
                  setSelectedStaffIds((prev) => {
                    const combined = new Set([...prev, ...visibleRowIds]);
                    return Array.from(combined);
                  });
                } else {
                  setSelectedStaffIds((prev) =>
                    prev.filter((id) => !visibleRowIds.includes(id))
                  );
                }
              }}
              aria-label="Select all"
              className="translate-y-[2px]"
              disabled={isReadonly}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="pr-2">
            <Checkbox
              checked={selectedStaffIds.includes(row.original.profile_id)}
              onCheckedChange={(value) => {
                const id = row.original.profile_id;
                setSelectedStaffIds((prev) =>
                  value ? [...prev, id] : prev.filter((x) => x !== id)
                );
              }}
              aria-label="Select row"
              className="translate-y-[2px]"
              disabled={isReadonly}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "first_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Staff Member" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                  style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                >
                  {getInitials(staff.first_name, staff.last_name)}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {staff.first_name} {staff.last_name}
                    </p>
                    {staff.isStaged && (
                      <Badge variant="secondary" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {staff.emails && staff.emails.length > 0
                      ? staff.emails.join(", ")
                      : staff.primary_email || "No email"}
                  </p>
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  staff.active ? "bg-green-500" : "bg-gray-400"
                }`}
                title={staff.active ? "Active" : "Inactive"}
              />
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value) return true;
          const valueLower = String(value).toLowerCase();
          const emails = staff.emails || [];
          const emailMatch =
            emails.some((e) => e.toLowerCase().includes(valueLower)) ||
            (staff.primary_email &&
              staff.primary_email.toLowerCase().includes(valueLower));
          return Boolean(
            staff.first_name.toLowerCase().includes(valueLower) ||
              staff.last_name.toLowerCase().includes(valueLower) ||
              emailMatch
          );
        },
      },
      {
        id: "name",
        accessorFn: (row: ProfileListItemWithRemove) => {
          const emails =
            row.emails && row.emails.length > 0
              ? row.emails.join(" ")
              : row.primary_email || "";
          return `${row.first_name} ${row.last_name} ${emails}`.toLowerCase();
        },
        header: "Search",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const RoleIcon = getRoleIcon(staff.role);
          return (
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {getRoleDisplayName(staff.role)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(staff.role);
        },
      },
      {
        accessorKey: "last_active",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Active" />
        ),
        cell: ({ row }) => {
          const lastActive = row.getValue("last_active") as string | null;
          const formatted = formatLastActive(lastActive);
          return (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span
                className={`text-sm ${!lastActive ? "text-muted-foreground" : ""}`}
              >
                {formatted}
              </span>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: "datetime",
      },
      {
        id: "lastActive",
        accessorFn: (row: ProfileListItemWithRemove) => {
          const lastActive = row.last_active;
          if (!lastActive) return "never";

          const date = new Date(lastActive);
          const now = new Date();
          const diffInDays = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffInDays < 7) return "recent";
          if (diffInDays <= 30) return "moderate";
          return "old";
        },
        header: "Last Active Category",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        id: "total_requests",
        accessorFn: (row) => row.total_requests ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Requests" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const total = staff.total_requests ?? 0;
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium">{total}</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value: string[]) => {
          const total = row.getValue("total_requests") as number;
          if (value.length === 0) return true;
          return value.some((category) => {
            if (category === "0") return total === 0;
            if (category === "1-10") return total >= 1 && total <= 10;
            if (category === "11-50") return total >= 11 && total <= 50;
            if (category === "51-100") return total >= 51 && total <= 100;
            if (category === "100+") return total > 100;
            return false;
          });
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      window.open(
                        `/analytics/reports/p/${staff.profile_id}`,
                        "_blank"
                      )
                    }
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Report</p>
                </TooltipContent>
              </Tooltip>
              {cohortId && !isReadonly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (staff.isStaged) {
                          setStagedProfileIdsToAdd((prev) =>
                            prev.filter((id) => id !== staff.profile_id)
                          );
                          toast.success("Removed staged profile");
                        } else {
                          if (!staff.can_remove) {
                            toast.error(
                              "You cannot remove this staff member from the cohort."
                            );
                            return;
                          }
                          setStagedProfileIdsToRemove((prev) => {
                            if (!prev.includes(staff.profile_id)) {
                              return [...prev, staff.profile_id];
                            }
                            return prev;
                          });
                          toast.success(
                            "Staff member staged for removal. Changes will be applied when you save."
                          );
                        }
                      }}
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove from Cohort</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [selectedStaffIds, isReadonly, cohortId]
  );

  // Staff table state
  const [staffColumnVisibility, setStaffColumnVisibility] =
    useState<VisibilityState>({
      name: false,
      active: false,
      lastActive: false,
      department_ids: false,
      cohort_ids: false,
      total_requests: true,
    });
  const [staffColumnFilters, setStaffColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [staffSorting, setStaffSorting] = useState<SortingState>([
    { id: "last_active", desc: true },
  ]);
  const [staffRowSelection, setStaffRowSelection] = useState({});

  const staffTable = useReactTable({
    data: staffDataForTable,
    columns: staffColumns,
    state: {
      sorting: staffSorting,
      columnVisibility: staffColumnVisibility,
      rowSelection: staffRowSelection,
      columnFilters: staffColumnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setStaffRowSelection,
    onSortingChange: setStaffSorting,
    onColumnFiltersChange: setStaffColumnFilters,
    onColumnVisibilityChange: setStaffColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
  });

  const staffNameColumn = staffTable.getColumn("name");
  const staffRoleColumn = staffTable.getColumn("role");
  const staffLastActiveColumn = staffTable.getColumn("lastActive");
  const staffTotalRequestsColumn = staffTable.getColumn("total_requests");
  const isStaffFiltered = staffTable.getState().columnFilters.length > 0;

  const filteredLastActiveOptions = useMemo(() => {
    const lastActiveOptions = [
      { value: "recent", label: "Recently Active (< 7 days)" },
      { value: "moderate", label: "Moderately Active (7-30 days)" },
      { value: "old", label: "Inactive (> 30 days)" },
      { value: "never", label: "Never Active" },
    ];
    if (!staffLastActiveColumn) return [];
    const facets = staffLastActiveColumn.getFacetedUniqueValues();
    if (!facets) return [];
    return lastActiveOptions.filter((option) => {
      const count = facets.get(option.value) || 0;
      return count > 0;
    });
  }, [staffLastActiveColumn]);

  const deletableStaffCount = useMemo(() => {
    return selectedStaffIds.filter((id) => {
      const staff = staffDataForTable.find((s) => s.profile_id === id);
      if (!staff) return false;
      if (staff.isStaged) return true;
      return staff.can_remove ?? false;
    }).length;
  }, [selectedStaffIds, staffDataForTable]);

  return (
    <div className="space-y-6">
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
                Cohort is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {cohortData?.department_ids?.length === 0
                    ? "This is a default cohort that cannot be edited. You can view the details but cannot make changes."
                    : "This cohort cannot be edited. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Basic Cohort Information */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData.title !== undefined ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter cohort title"
              className={errors.title ? "border-destructive" : ""}
              disabled={isReadonly}
              data-testid="input-cohort-title"
            />
          ) : null}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter cohort description (optional)"
              rows={3}
              disabled={isReadonly}
              data-testid="input-cohort-description"
            />
          ) : null}
        </div>

        {/* Department Selection */}
        {cohortData?.valid_department_ids &&
          cohortData.valid_department_ids.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {formData?.departmentIds !== undefined ? (
                <GenericPicker
                  items={cohortData?.department_mapping || {}}
                  itemIds={cohortData?.valid_department_ids || []}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) => handleInputChange("departmentIds", ids)}
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
              ) : null}
            </div>
          )}

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
              {formData.active !== undefined ? (
                <Switch
                  id="active"
                  checked={formData.active ?? true}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={isReadonly}
                  data-testid="switch-cohort-active"
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive cohorts will not be shown
            </p>
          </div>
        </div>

        {/* Simulations */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="simulations">Simulations</Label>
            </div>
            <div className="flex gap-2">
              <GenericPicker
                items={cohortData?.simulation_mapping || {}}
                itemIds={validSimulationIds}
                selectedIds={currentSimulationIds}
                onSelect={handleSimulationSelection}
                getId={(sim) => (sim as unknown as { id: string }).id}
                getLabel={(sim) => sim.name || ""}
                getSearchText={(sim) => `${sim.name} ${sim.description || ""}`}
                renderPreview={(sim) => {
                  const formatTimeLimit = (timeLimit?: number | null) => {
                    if (!timeLimit || timeLimit === 0) return "No time limit";
                    if (timeLimit < 60) return `${timeLimit} minutes`;
                    const hours = Math.floor(timeLimit / 60);
                    const minutes = timeLimit % 60;
                    if (minutes === 0)
                      return `${hours} hour${hours !== 1 ? "s" : ""}`;
                    return `${hours}h ${minutes}m`;
                  };
                  return (
                    <div className="grid gap-2">
                      <h4 className="font-medium leading-none">{sim.name}</h4>
                      <div className="text-sm text-muted-foreground">
                        {sim.description || "No description available"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {formatTimeLimit(
                            (sim as { time_limit?: number | null }).time_limit
                          )}
                        </Badge>
                      </div>
                    </div>
                  );
                }}
                placeholder="Add simulation"
                showLabel={false}
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="w-48"
                disabled={isReadonly}
                groupHeading="Simulations"
              />
            </div>
          </div>

          {currentSimulationIds.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No simulations selected</p>
                <p className="text-sm">
                  Use the dropdown above to add simulations to this cohort
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentSimulationIds.map((simulationId) => {
                const simulation = cohortData?.simulation_mapping[simulationId];
                if (!simulation) return null;

                const simulationData = cohortData?.simulations?.find(
                  (s) => s.simulation_id === simulationId
                );

                const isExistingSimulation =
                  cohortData?.simulation_ids.includes(simulationId) ?? false;

                const shouldShowRemove = isExistingSimulation
                  ? (simulationData?.can_remove ?? false)
                  : true;

                const isSimulationActive =
                  simulationActiveStates[simulationId] ?? true;

                const formatLastUsed = (date: string | null): string => {
                  if (!date) return "Never";
                  const d = new Date(date);
                  return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                };

                return (
                  <Card
                    key={simulationId}
                    className={`p-4 cursor-move hover:shadow-md transition-all flex flex-col h-full ${
                      draggedSimulation === simulationId ? "opacity-50" : ""
                    } ${!isSimulationActive ? "opacity-50 bg-muted" : ""}`}
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartSimulation(e, simulationId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, simulationId)}
                    data-testid="simulation-card"
                    data-simulation-id={simulationId}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {simulation.name || "Unnamed Simulation"}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-4 mt-2">
                          {simulation.description || "No description provided"}
                        </p>
                      </div>
                      {isExistingSimulation && !isReadonly && (
                        <Switch
                          checked={simulationActiveStates[simulationId] ?? true}
                          onCheckedChange={(checked) =>
                            setSimulationActiveStates((prev) => ({
                              ...prev,
                              [simulationId]: checked,
                            }))
                          }
                        />
                      )}
                    </div>

                    <div className="flex-grow flex flex-col">
                      <div className="space-y-2 mt-auto">
                        {isExistingSimulation && simulationData && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                            <div className="flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              <span>Usage: {simulationData.usage_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                Last: {formatLastUsed(simulationData.last_used)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                Success: {simulationData.success_rate}%
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editSimulation(simulationId)}
                            data-testid="btn-view-simulation-details"
                          >
                            View Details
                          </Button>

                          {!isReadonly && shouldShowRemove && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeSimulation(simulationId)}
                              data-testid="btn-remove-simulation"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff Management - Inline Table */}
        {cohortId && cohortData && (
          <div className="space-y-4">
            <TooltipProvider>
              <div className="space-y-2">
                {/* Toolbar */}
                <div
                  className="flex items-center justify-between"
                  data-testid="staff-toolbar"
                >
                  <div className="flex flex-1 items-center space-x-2 flex-wrap">
                    <div className="mb-2 w-full md:w-auto">
                      <Input
                        placeholder="Search staff by name or email..."
                        value={
                          (staffNameColumn?.getFilterValue() as string) ?? ""
                        }
                        onChange={(event) =>
                          staffNameColumn?.setFilterValue(event.target.value)
                        }
                        className="h-8 w-full md:w-[150px] lg:w-[250px]"
                        data-testid="staff-search"
                      />
                    </div>

                    <div className="flex items-center space-x-2 flex-wrap mb-2">
                      {staffRoleColumn && roleOptions.length > 0 && (
                        <DataTableFacetedFilter
                          column={staffRoleColumn}
                          title="Role"
                          options={roleOptions}
                        />
                      )}

                      {staffLastActiveColumn &&
                        filteredLastActiveOptions.length > 0 && (
                          <DataTableFacetedFilter
                            column={staffLastActiveColumn}
                            title="Last Active"
                            options={filteredLastActiveOptions}
                          />
                        )}

                      {staffTotalRequestsColumn && (
                        <DataTableFacetedFilter
                          column={staffTotalRequestsColumn}
                          title="Requests"
                          options={[
                            { value: "0", label: "0" },
                            { value: "1-10", label: "1-10" },
                            { value: "11-50", label: "11-50" },
                            { value: "51-100", label: "51-100" },
                            { value: "100+", label: "100+" },
                          ]}
                        />
                      )}

                      {isStaffFiltered && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => staffTable.resetColumnFilters()}
                          className="h-8 px-2 lg:px-3 hidden md:flex"
                        >
                          Reset
                          <X className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    {selectedStaffIds.length === 0 && !isReadonly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => setShowStaffSearchModal(true)}
                        disabled={!searchAddStaff}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Add Staff
                      </Button>
                    )}

                    {selectedStaffIds.length > 0 && !isReadonly && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkRemoveDialog(true)}
                        className="h-8"
                        disabled={deletableStaffCount === 0}
                      >
                        Remove {deletableStaffCount} of{" "}
                        {selectedStaffIds.length}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsRefreshing(true);
                        setTimeout(() => setIsRefreshing(false), 100);
                      }}
                      disabled={isRefreshing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                    </Button>

                    <DataTableViewOptions
                      table={staffTable}
                      hiddenColumns={["cohort_ids", "department_ids"]}
                    />
                  </div>
                </div>

                {/* Table */}
                <div
                  className="rounded-md border overflow-x-auto"
                  data-testid="staff-table"
                >
                  <Table>
                    <TableHeader>
                      {staffTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            if (!header.column.getIsVisible()) return null;

                            return (
                              <TableHead
                                key={header.id}
                                colSpan={header.colSpan}
                                className={`border-r py-2 text-xs text-center ${
                                  header.id === "select" ? "w-12" : ""
                                } ${
                                  header.column.getCanSort()
                                    ? "cursor-pointer select-none pl-4"
                                    : ""
                                }`}
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {staffTable.getRowModel().rows?.length ? (
                        staffTable.getRowModel().rows.map((row) => (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && "selected"}
                            className="hover:bg-muted/30 transition-colors"
                            data-testid="staff-row"
                            data-profile-id={row.original.profile_id}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className="border-r px-3 py-2 text-center"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={staffColumns.length}
                            className="h-24 text-center px-6"
                          >
                            No staff members found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <DataTablePagination table={staffTable} staff={true} />
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Bulk Remove from Cohort Confirmation */}
        {cohortId && (
          <AlertDialog
            open={showBulkRemoveDialog}
            onOpenChange={setShowBulkRemoveDialog}
          >
            <AlertDialogContent
              aria-labelledby="bulk-remove-staff-title"
              data-testid="dialog-bulk-remove-staff"
            >
              <AlertDialogHeader>
                <AlertDialogTitle id="bulk-remove-staff-title">
                  Remove {selectedStaffIds.length} staff member
                  {selectedStaffIds.length !== 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove them from the cohort. Changes will be applied
                  when you save.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="btn-cancel-bulk-remove-staff">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  data-testid="btn-confirm-bulk-remove-staff"
                  onClick={() => {
                    if (selectedStaffIds.length === 0 || !cohortId) return;

                    const existingStaffIds = new Set(
                      cohortData?.staff?.map((s) => s.profile_id) || []
                    );

                    const removableIds = selectedStaffIds.filter((id) => {
                      const staff = staffDataForTable.find(
                        (s) => s.profile_id === id
                      );
                      if (!staff) return false;
                      if (staff.isStaged) return true;
                      return staff.can_remove ?? false;
                    });

                    const stagedIds = removableIds.filter(
                      (id) => !existingStaffIds.has(id)
                    );
                    const existingIds = removableIds.filter((id) =>
                      existingStaffIds.has(id)
                    );

                    if (stagedIds.length > 0) {
                      setStagedProfileIdsToAdd((prev) =>
                        prev.filter((p) => !stagedIds.includes(p))
                      );
                    }

                    if (existingIds.length > 0) {
                      setStagedProfileIdsToRemove((prev) => {
                        const newRemovals = existingIds.filter(
                          (id) => !prev.includes(id)
                        );
                        return [...prev, ...newRemovals];
                      });
                    }

                    toast.success(
                      `${removableIds.length} staff member(s) staged for removal. Changes will be applied when you save the cohort.`
                    );
                    setSelectedStaffIds([]);
                    setShowBulkRemoveDialog(false);
                  }}
                >
                  Stage Removal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/create/cohorts")}
              data-testid="btn-cancel-cohort"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || isReadonly || (isEditMode && !hasChanges)
              }
              className="min-w-[120px]"
              data-testid="btn-submit-cohort"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {cohortId || editingCohortId ? "Updating..." : "Creating..."}
                </>
              ) : cohortId || editingCohortId ? (
                "Update Cohort"
              ) : (
                "Create Cohort"
              )}
            </Button>
          </>
        </div>
      </form>

      {/* Staff Search Modal */}
      {searchAddStaff && (
        <Dialog
          open={showStaffSearchModal}
          onOpenChange={setShowStaffSearchModal}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Search Existing Staff</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or email"
                  value={staffSearchQuery}
                  onChange={(e) => handleStaffSearchQueryChange(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
                {isSearchingStaff && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {isSearchingStaff ? (
                  <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading profiles...
                  </div>
                ) : staffSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {staffSearchQuery && staffSearchQuery.trim()
                      ? "No profiles found matching your search"
                      : cohortId
                        ? "All available profiles are already in this cohort"
                        : "Start typing to search for profiles"}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Alias</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffSearchResults.map((profile) => {
                        const isSelected = staffSearchSelectedIds.has(
                          profile.profile_id
                        );
                        return (
                          <TableRow
                            key={profile.profile_id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleToggleProfile(profile)}
                          >
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="w-[50px]"
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  handleToggleProfile(profile)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {profile.first_name} {profile.last_name}
                            </TableCell>
                            <TableCell>
                              {profile.emails && profile.emails.length > 0
                                ? profile.emails.join(", ")
                                : profile.primary_email || "No email"}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const roleData = STAFF_ROLES.find(
                                  (r) => r.id === profile.role
                                );
                                if (!roleData) {
                                  return (
                                    <Badge variant="outline">
                                      {profile.role}
                                    </Badge>
                                  );
                                }
                                const IconComponent = roleData.icon;
                                const hexColor = roleData.color || "#64748b";
                                // Generate gradient from hex color
                                const cleanHex = hexColor.replace("#", "");
                                const r = parseInt(cleanHex.substr(0, 2), 16);
                                const g = parseInt(cleanHex.substr(2, 2), 16);
                                const b = parseInt(cleanHex.substr(4, 2), 16);
                                const lighterR = Math.min(255, r + 60);
                                const lighterG = Math.min(255, g + 60);
                                const lighterB = Math.min(255, b + 60);
                                const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                                const gradientStyle = `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;

                                return (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="p-1.5 rounded-md shadow-sm flex-shrink-0"
                                      style={{
                                        background: gradientStyle,
                                      }}
                                    >
                                      <IconComponent className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className="text-sm">
                                      {roleData.name}
                                    </span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from(staffSearchSelectedProfiles.values()).map(
                    (profile) => (
                      <Badge
                        key={profile.profile_id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <span>
                          {profile.first_name} {profile.last_name}
                        </span>
                        <button
                          onClick={() => handleToggleProfile(profile)}
                          className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                          aria-label={`Remove ${profile.first_name} ${profile.last_name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowStaffSearchModal(false)}
                  >
                    Cancel
                  </Button>
                  {staffSearchSelectedIds.size > 0 && (
                    <Button onClick={handleAddSelectedStaff}>
                      Add {staffSearchSelectedIds.size} Staff
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent
          aria-labelledby="update-cohort-title"
          data-testid="dialog-update-cohort"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="update-cohort-title">
              Update Cohort
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cohort is currently used by{" "}
              {currentSimulationIds.length || 0} simulation
              {(currentSimulationIds.length || 0) !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {currentSimulationIds.map((simId) => {
                  const sim = cohortData?.simulation_mapping[simId];
                  return (
                    <li key={simId} className="text-sm">
                      {sim?.name || "Unknown Simulation"}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 text-sm font-medium">
                The cohort has {cohortData?.staff?.length || 0} member
                {(cohortData?.staff?.length || 0) !== 1 ? "s" : ""} assigned.
                Updating this cohort will affect all simulations that use it.
                Are you sure you want to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              data-testid="btn-cancel-update"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="btn-confirm-update"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
