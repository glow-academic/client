/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

import type {
  DepartmentDetailOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
} from "@/app/(main)/system/departments/d/[departmentId]/page";
import type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewOut,
} from "@/app/(main)/system/departments/new/page";
import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
} from "@/app/(main)/system/departments/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Power, Trash2 } from "lucide-react";
import {
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

export interface DepartmentProps {
  departmentId?: string;
  // Optional server-provided data (for server-side rendering)
  departmentDetail?: DepartmentDetailOut;
  departmentDetailDefault?: DepartmentNewOut;
  // Server actions (replaces useMutation)
  createDepartmentAction?: (
    input: CreateDepartmentIn,
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn,
  ) => Promise<UpdateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn,
  ) => Promise<DeleteDepartmentOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchDepartmentDraftAction?: (
    input: PatchDepartmentDraftIn,
  ) => Promise<PatchDepartmentDraftOut>;
}

function DepartmentComponent({
  departmentId,
  departmentDetail: serverDepartmentDetail,
  departmentDetailDefault: serverDepartmentDetailDefault,
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
  patchDepartmentDraftAction,
}: DepartmentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!departmentId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverDepartmentDetail | typeof serverDepartmentDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("department_id" in data && data.department_id) {
          return `department_id:${String(data.department_id)}`;
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

  const departmentDetailId = React.useMemo(
    () => stabilizeServerProp(serverDepartmentDetail),
    [serverDepartmentDetail, stabilizeServerProp]
  );
  const departmentDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverDepartmentDetailDefault),
    [serverDepartmentDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerDepartmentDetailRef = React.useRef(serverDepartmentDetail);
  const latestServerDepartmentDetailDefaultRef = React.useRef(
    serverDepartmentDetailDefault
  );

  latestServerDepartmentDetailRef.current = serverDepartmentDetail;
  latestServerDepartmentDetailDefaultRef.current = serverDepartmentDetailDefault;

  // Use refs to track stable server props
  const stableDepartmentDetailRef = React.useRef<{
    data: typeof serverDepartmentDetail;
    id: string | null;
  }>({
    data: serverDepartmentDetail,
    id: departmentDetailId,
  });
  const stableDepartmentDetailDefaultRef = React.useRef<{
    data: typeof serverDepartmentDetailDefault;
    id: string | null;
  }>({
    data: serverDepartmentDetailDefault,
    id: departmentDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableDepartmentDetailRef.current.id !== departmentDetailId) {
      stableDepartmentDetailRef.current = {
        data: latestServerDepartmentDetailRef.current,
        id: departmentDetailId,
      };
    }
  }, [departmentDetailId]);

  React.useEffect(() => {
    if (
      stableDepartmentDetailDefaultRef.current.id !== departmentDetailDefaultId
    ) {
      stableDepartmentDetailDefaultRef.current = {
        data: latestServerDepartmentDetailDefaultRef.current,
        id: departmentDetailDefaultId,
      };
    }
  }, [departmentDetailDefaultId]);

  // Use stable references
  const departmentDetail = stableDepartmentDetailRef.current.data;
  const departmentDetailDefault =
    stableDepartmentDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const departmentDataId = React.useMemo(() => {
    const data = isEditMode ? departmentDetail : departmentDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("department_id" in data && data.department_id) {
        return `department_id:${String(data.department_id)}`;
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
  }, [isEditMode, departmentDetail, departmentDetailDefault]);

  const stableDepartmentDataRef = React.useRef<{
    data: typeof departmentDetail | typeof departmentDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? departmentDetail : departmentDetailDefault,
    id: departmentDataId,
  });

  React.useEffect(() => {
    if (stableDepartmentDataRef.current.id !== departmentDataId) {
      stableDepartmentDataRef.current = {
        data: isEditMode ? departmentDetail : departmentDetailDefault,
        id: departmentDataId,
      };
    }
  }, [isEditMode, departmentDetail, departmentDetailDefault, departmentDataId]);

  const departmentData = stableDepartmentDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only)
  const departmentSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams] = useQueryStates(departmentSearchParamsClient, {
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

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    title: string;
    description: string;
    active: boolean;
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? departmentDetail : departmentDetailDefault;

    if (!data) {
      return {
        title: "",
        description: "",
        active: true,
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      title: data.title || "",
      description: data.description || "",
      active: data.active ?? true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    departmentDetail,
    departmentDetailDefault,
    departmentDetailId,
    departmentDetailDefaultId,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    departmentDetailDefault?.title,
    departmentDetailDefault?.description,
    departmentDetailDefault?.active,
    departmentDetail?.title,
    departmentDetail?.description,
    departmentDetail?.active,
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
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState((currentDraftState) => {
        // Check if new state is "empty" (no title) but current state has content
        const newStateIsEmpty =
          (!initialDraftState.title || initialDraftState.title.trim() === "");

        const currentStateHasContent =
          (currentDraftState.title?.trim() || "").length > 0;

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
    patchDraftAction: patchDepartmentDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchDepartmentDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchDepartmentDraftIn["body"],
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

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
    } as Record<string, unknown>;
  }, [draftState]);

  // Wrapper for setFormData that updates draftState for form fields
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (key === "title" || key === "description" || key === "active") {
          draftUpdates[key as keyof DraftState] = value as never;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
    },
    [formData]
  );

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !departmentData) return false;
    // Check if user is admin or superadmin - they can always edit
    if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      return false;
    }
    return !(departmentData && "can_edit" in departmentData && departmentData.can_edit);
  }, [isEditMode, departmentData, effectiveProfile?.role]);

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

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("title" in serverData)
      ) {
        return {};
      }

      const departmentDetail = serverData as DepartmentDetailOut;

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (departmentDetail.title) draftUpdates.title = departmentDetail.title;
      if (departmentDetail.description)
        draftUpdates.description = departmentDetail.description;
      if (departmentDetail.active !== undefined)
        draftUpdates.active = departmentDetail.active ?? true;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    []
  );

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!draftState.title?.trim()) {
      toast.error("Title is required");
        throw new Error("Title is required");
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (isEditMode) {
        if (!updateDepartmentAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          const settingsId = departmentData && "settings_id" in departmentData ? departmentData.settings_id : null;
          if (!settingsId) {
            toast.error("Settings ID is required to update department");
            throw new Error("Settings ID is required");
          }
          await updateDepartmentAction({
            body: {
              department_id: departmentId!,
              title: draftState.title || "",
              description: draftState.description || "",
              active: draftState.active ?? true,
              settings_id: settingsId,
            },
          });
        toast.success("Department updated successfully!");
        router.push("/system/departments");
        } catch (error) {
          toast.error(
            `Failed to update department: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createDepartmentAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          // For create, we need a settings_id - get from default or use first available
          const settingsId = departmentDetailDefault && "settings" in departmentDetailDefault && departmentDetailDefault.settings && Array.isArray(departmentDetailDefault.settings) && departmentDetailDefault.settings.length > 0
            ? departmentDetailDefault.settings[0]?.settings_id ?? null
            : null;
          if (!settingsId) {
            toast.error("Settings ID is required to create department");
            throw new Error("Settings ID is required");
          }
          await createDepartmentAction({
            body: {
              title: draftState.title || "",
              description: draftState.description || "",
              active: draftState.active ?? true,
              settings_id: settingsId,
            },
          });
        toast.success("Department created successfully!");
        router.push("/system/departments");
    } catch (error) {
      toast.error(
            `Failed to create department: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      departmentId,
      effectiveProfile?.id,
      updateDepartmentAction,
      createDepartmentAction,
      router,
    ]
  );

  const handleDelete = async () => {
    if (!departmentId || !deleteDepartmentAction) return;

    try {
      await deleteDepartmentAction({
        body: { department_id: departmentId },
      });
      toast.success("Department deleted successfully");
      router.push("/system/departments");
    } catch (error) {
      toast.error(
        `Failed to delete department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasTitle = !!(
        formData["title"] as string | null | undefined
      )?.trim();

      switch (stepId) {
        case "basic":
          return hasTitle ? "completed" : "active";
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
          "Set the department name, description, and active status.",
        resetFields: ["title", "description", "active"] as string[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => ["title", "description", "active"],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/departments",
      backLabel: "Back",
      createLabel: "Create Department",
      updateLabel: "Update Department",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      onReset?: () => void;
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
                  (stepFormData["title"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ title: value || null }),
                placeholder: "New Department",
                defaultName: "New Department",
                required: true,
              }}
              resetFields={["title", "description", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-department-description"
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
                    placeholder="Enter a brief description (optional)"
                    rows={3}
                    disabled={isReadonly}
                  />
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
                      <Switch
                        id="active"
                        data-testid="switch-department-active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (departmentData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive departments will not be visible to users
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [departmentData, isReadonly, isEditMode]
  );

  return (
    <TooltipProvider>
    <div
        className="w-full p-6 space-y-8"
        data-page={`department-${isEditMode ? "edit" : "new"}`}
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
                    : (departmentData && "in_use" in departmentData && departmentData.in_use)
                      ? "This department is currently in use and cannot be edited. You can view the details but cannot make changes."
                      : "You do not have permission to edit this department. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

        <GenericForm
          nuqsParsers={
            departmentSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={departmentData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
        />

        {/* Delete button - positioned to match submit button area */}
          {isEditMode &&
            departmentData && "can_delete" in departmentData && departmentData.can_delete &&
            deleteDepartmentAction && (
            <div className="flex justify-end gap-3 -mt-8">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="btn-delete-department"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

      {/* Delete Confirmation Dialog */}
        {isEditMode && deleteDepartmentAction && (
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
                {departmentData && "in_use" in departmentData && departmentData.in_use && (
                  <div className="mt-2 text-sm font-medium text-destructive">
                    Warning: This department is currently in use and cannot be
                    deleted.
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                  disabled={false}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                  disabled={departmentData && "in_use" in departmentData ? (departmentData.in_use ?? false) : false}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="btn-confirm-delete"
              >
                  Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
    </TooltipProvider>
  );
}

// Helper function to generate stable ID from server prop
function getStableServerPropId(
  data: DepartmentDetailOut | DepartmentNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("department_id" in data && data.department_id) {
      return `department_id:${String(data.department_id)}`;
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
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(DepartmentComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.departmentDetail);
  const nextDetailId = getStableServerPropId(nextProps.departmentDetail);
  const prevDefaultId = getStableServerPropId(prevProps.departmentDetailDefault);
  const nextDefaultId = getStableServerPropId(
    nextProps.departmentDetailDefault
  );

  // Compare primitive props
  if (prevProps.departmentId !== nextProps.departmentId) {
    return false; // Props changed, re-render
  }

  // Compare server props by content ID, not reference
  if (prevDetailId !== nextDetailId) {
    return false; // Content changed, re-render
  }

  if (prevDefaultId !== nextDefaultId) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
