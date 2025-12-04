/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
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

import { STAFF_ROLES } from "@/components/common/forms/StaffRolePicker";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  Clock,
  Eye,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
  UserMinus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
// Type-only import from server page
import type { ProfileListItem } from "@/app/(main)/management/staff/page";
// Import types from new page (create action)
import type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewOut,
} from "@/app/(main)/departments/new/page";
// Import types from edit page (update action)
import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DepartmentDetailOut,
  RemoveProfilesFromDepartmentIn,
  RemoveProfilesFromDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/departments/d/[departmentId]/page";
// Import types from list page (delete/duplicate actions)
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
} from "@/app/(main)/departments/page";
// Import staff item types from API responses
import type { DepartmentStaffItem } from "@/app/(main)/departments/d/[departmentId]/page";
import type { DepartmentDefaultStaffItem } from "@/app/(main)/departments/new/page";

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
    case "ta":
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
    case "ta":
      return "Teaching Assistant";
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

// Helper to normalize department staff item to ProfileListItem format
type ProfileListItemWithRemove = ProfileListItem & {
  can_remove?: boolean;
  isStaged?: boolean;
};

const normalizeDepartmentStaffItem = (
  item: DepartmentStaffItem | DepartmentDefaultStaffItem
): ProfileListItemWithRemove => {
  return {
    profile_id: item.profile_id,
    first_name: item.first_name,
    last_name: item.last_name,
    emails: "emails" in item ? item.emails || [] : [],
    primary_email: "primary_email" in item ? item.primary_email || "" : "",
    name: item.name,
    role: item.role,
    initials: item.initials,
    active: item.active,
    last_active: item.last_active ?? null,
    cohort_ids: item.cohort_ids ?? [],
    department_ids: item.department_ids ?? [],
    primary_department_id:
      "primary_department_id" in item ? item.primary_department_id : "",
    requests_per_day: item.requests_per_day ?? null,
    total_requests: item.total_requests ?? 0,
    requests_in_last_day: item.requests_in_last_day ?? 0,
    can_edit: item.can_edit,
    can_delete: item.can_delete,
    can_remove: "can_remove" in item ? item.can_remove : false,
  };
};

export interface DepartmentProps {
  departmentId?: string;
  // Optional server-provided data (for server-side rendering)
  departmentDetail?: DepartmentDetailOut;
  departmentDetailDefault?: DepartmentNewOut;
  // Server actions (replaces useMutation)
  createDepartmentAction?: (
    input: CreateDepartmentIn
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn
  ) => Promise<UpdateDepartmentOut>;
  removeProfilesFromDepartmentAction?: (
    input: RemoveProfilesFromDepartmentIn
  ) => Promise<RemoveProfilesFromDepartmentOut>;
  duplicateDepartmentAction?: (
    input: DuplicateDepartmentIn
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn
  ) => Promise<DeleteDepartmentOut>;
  // Add-staff search function (search-only, no mutation - profiles are staged and sent in update)
  searchAddStaff?: (input: {
    body: {
      departmentId: string | null;
      query: string | null;
      limit: number;
      profileId: string;
    };
  }) => Promise<{
    staff: ProfileListItem[];
    cohort_mapping: Record<string, { name: string; description: string }>;
    department_mapping: Record<string, { name: string; description: string }>;
  }>;
  // Key management actions
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  decryptKeyAction?: (input: DecryptKeyIn) => Promise<DecryptKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
}

interface FormErrors {
  title?: string;
  description?: string;
}

interface FormData {
  title?: string;
  description?: string;
  active?: boolean;
}

export default function Department({
  departmentId,
  departmentDetail: serverDepartmentDetail,
  departmentDetailDefault: serverDepartmentDetailDefault,
  createDepartmentAction,
  updateDepartmentAction,
  removeProfilesFromDepartmentAction,
  duplicateDepartmentAction: _duplicateDepartmentAction,
  deleteDepartmentAction,
  searchAddStaff,
  createKeyAction: _createKeyAction,
  decryptKeyAction: _decryptKeyAction,
  updateKeyAction: _updateKeyAction,
}: DepartmentProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      active: true,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
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
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use server-provided data (no React Query needed when server data is provided)
  const departmentDetail = serverDepartmentDetail;
  const departmentDetailDefault = serverDepartmentDetailDefault;

  // Role options from scopedRoles
  const roleOptions = useMemo(() => {
    const roleLabels: Record<string, string> = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      instructional: "Instructional Staff",
      ta: "Teaching Assistant",
      guest: "Guest",
    };
    return (scopedRoles || []).map((role) => ({
      value: role,
      label: roleLabels[role] || role,
    }));
  }, [scopedRoles]);

  // Use edit detail when editing, default detail when creating
  const departmentData = isEditMode
    ? departmentDetail
    : departmentDetailDefault;

  // Set breadcrumb context when department data is loaded
  useEffect(() => {
    if (departmentDetail?.title && departmentId && isEditMode) {
      setEntityMetadata({
        entityId: departmentId,
        entityName: departmentDetail.title,
        entityType: "department",
      });
    }
    return () => clearEntityMetadata();
  }, [
    departmentDetail,
    departmentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types from server action types for type safety
  type CreateDepartmentBody = CreateDepartmentIn extends { body: infer B }
    ? B
    : never;
  type UpdateDepartmentBody = UpdateDepartmentIn extends { body: infer B }
    ? B
    : never;
  type RemoveProfilesFromDepartmentBody =
    RemoveProfilesFromDepartmentIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreateDepartment = async (body: CreateDepartmentBody) => {
    if (!createDepartmentAction) {
      throw new Error("createDepartmentAction is required");
    }
    await createDepartmentAction({ body });
  };

  const handleUpdateDepartment = async (body: UpdateDepartmentBody) => {
    if (!updateDepartmentAction) {
      throw new Error("updateDepartmentAction is required");
    }
    await updateDepartmentAction({ body });
  };

  const handleRemoveProfilesFromDepartment = async (
    body: RemoveProfilesFromDepartmentBody
  ) => {
    if (!removeProfilesFromDepartmentAction) {
      throw new Error("removeProfilesFromDepartmentAction is required");
    }
    await removeProfilesFromDepartmentAction({ body });
  };

  // Readonly logic using v2 permission flags
  // Admins and superadmins can always edit regardless of in_use flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !departmentData) return false;
    // Check if user is admin or superadmin - they can always edit
    if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      return false;
    }
    return !departmentData.can_edit;
  }, [isEditMode, departmentData, effectiveProfile?.role]);

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (departmentData && isEditMode) {
      const departmentFormData = {
        title: departmentData.title,
        description: departmentData.description || "",
        active: departmentData.active ?? true,
      };
      setFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active;
        return hasChanged ? departmentFormData : prev;
      });
      setOriginalFormData((prev) => {
        const hasChanged =
          prev?.title !== departmentFormData.title ||
          prev?.description !== departmentFormData.description ||
          prev?.active !== departmentFormData.active;
        return hasChanged ? departmentFormData : prev;
      });
    } else if (!isEditMode && departmentData) {
      // For create mode, use defaults
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [departmentData, isEditMode, initialFormData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original profile IDs from departmentData
    const originalProfileIds =
      departmentData?.staff?.map((s) => s.profile_id) || [];

    return (
      current?.title !== original?.title ||
      current?.description !== original?.description ||
      current?.active !== original?.active ||
      stagedProfileIdsToAdd.length > 0 ||
      stagedProfileIdsToRemove.length > 0
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    departmentData?.staff,
    stagedProfileIdsToAdd.length,
    stagedProfileIdsToRemove.length,
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setErrors({});
    setSelectedStaffIds([]);
    setStagedProfileIdsToAdd([]);
    setStagedProfileIdsToRemove([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData?.title) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      toast.error("Title is required");
      return;
    }

    if (!formData?.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      toast.error("Description is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Compute final profile_ids array: existing - removals + additions
      const existingProfileIds =
        departmentId && departmentData?.staff
          ? departmentData.staff.map((s) => s.profile_id)
          : [];
      const finalProfileIds = [
        ...existingProfileIds.filter(
          (id) => !stagedProfileIdsToRemove.includes(id)
        ),
        ...stagedProfileIdsToAdd.filter(
          (id) => !existingProfileIds.includes(id)
        ),
      ];

      if (isEditMode && departmentId) {
        // UPDATE mode
        await handleUpdateDepartment({
          departmentId: departmentId,
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
          profile_ids: finalProfileIds,
        });
        // Clear staged profiles after successful update
        setStagedProfileIdsToAdd([]);
        setStagedProfileIdsToRemove([]);
        resetFormAndState();
        toast.success("Department updated successfully!");
        router.push("/departments");
      } else {
        // CREATE mode
        await handleCreateDepartment({
          title: formData.title || "",
          description: formData.description || "",
          active: formData.active ?? true,
          profile_ids: finalProfileIds,
        });
        // Clear staged profiles after successful create
        setStagedProfileIdsToAdd([]);
        setStagedProfileIdsToRemove([]);
        resetFormAndState();
        toast.success("Department created successfully!");
        router.push("/departments");
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
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
            departmentId: departmentId || null,
            query: normalizedQuery,
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
    [effectiveProfile?.id, searchAddStaff, departmentId]
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

  // Initial search when modal opens
  useEffect(() => {
    if (
      showStaffSearchModal &&
      searchAddStaff &&
      effectiveProfile?.id &&
      staffSearchResults.length === 0 &&
      !isSearchingStaff
    ) {
      setIsSearchingStaff(true);
      searchAddStaff({
        body: {
          departmentId: departmentId || null,
          query: null,
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
    }
  }, [
    showStaffSearchModal,
    searchAddStaff,
    effectiveProfile?.id,
    departmentId,
    staffSearchResults.length,
    isSearchingStaff,
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
    if (!departmentId || !departmentData) return [];

    const existingStaff = departmentData.staff || [];
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
          role: "ta",
          initials: "??",
          active: true,
          last_active: null,
          cohort_ids: [],
          department_ids: departmentId ? [departmentId] : [],
          primary_department_id: departmentId || "",
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
      normalizeDepartmentStaffItem
    );

    return [...stagedProfiles, ...normalizedExistingStaff];
  }, [
    departmentId,
    departmentData,
    stagedProfileIdsToAdd,
    stagedProfileIdsToRemove,
    staffSearchResults,
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
              {departmentId && !isReadonly && (
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
                              "You cannot remove this staff member from the department."
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
                    <p>Remove from Department</p>
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
    [selectedStaffIds, isReadonly, departmentId]
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

  const handleDelete = async () => {
    if (!departmentId || !deleteDepartmentAction) return;

    setIsSubmitting(true);
    try {
      await deleteDepartmentAction({
        body: { departmentId },
      });
      toast.success("Department deleted successfully");
      router.push("/departments");
    } catch (error) {
      toast.error(
        `Failed to delete department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div
      className="space-y-6"
      data-page={isEditMode ? "department-edit" : "department-new"}
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
                Department is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {effectiveProfile?.role === "admin" ||
                  effectiveProfile?.role === "superadmin"
                    ? "You do not have permission to edit this department. You can view the details but cannot make changes."
                    : departmentData?.in_use
                      ? "This department is currently in use and cannot be edited. You can view the details but cannot make changes."
                      : "You do not have permission to edit this department. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData?.title !== undefined ? (
            <Input
              id="title"
              data-testid="input-department-title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
              required
              disabled={isReadonly}
            />
          ) : null}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          {formData?.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-department-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
              required
              disabled={isReadonly}
            />
          ) : null}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
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
                  data-testid="switch-department-active"
                  checked={formData.active ?? true}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={isReadonly}
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive departments will not be visible to users
            </p>
          </div>
        </div>

        {/* Staff Management - Inline Table */}
        {departmentId && departmentData && (
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

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/departments")}
            data-testid="btn-cancel-department"
          >
            Back
          </Button>
          {isEditMode &&
            departmentData?.can_delete &&
            deleteDepartmentAction && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isSubmitting}
                data-testid="btn-delete-department"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          <Button
            type="submit"
            disabled={isSubmitting || isReadonly || (isEditMode && !hasChanges)}
            className="min-w-[120px]"
            data-testid="btn-submit-department"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Department"
            ) : (
              "Create Department"
            )}
          </Button>
        </div>
      </form>

      {/* Bulk Remove from Department Confirmation */}
      {departmentId && (
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
                This will remove them from the department. Changes will be
                applied when you save.
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
                  if (selectedStaffIds.length === 0 || !departmentId) return;

                  const existingStaffIds = new Set(
                    departmentData?.staff?.map((s) => s.profile_id) || []
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
                    `${removableIds.length} staff member(s) staged for removal. Changes will be applied when you save the department.`
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
                      : departmentId
                        ? "All available profiles are already in this department"
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

      {/* Delete Confirmation Dialog */}
      {isEditMode && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-department-title"
            data-testid="dialog-delete-department"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-department-title">
                Delete Department
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{departmentData?.title}"? This
                action cannot be undone.
                {departmentData?.in_use && (
                  <div className="mt-2 text-sm font-medium text-destructive">
                    Warning: This department is currently in use and cannot be
                    deleted.
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isSubmitting}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isSubmitting || departmentData?.in_use}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="btn-confirm-delete"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
