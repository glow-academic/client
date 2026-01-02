/**
 * Auth.tsx
 * Used to create and manage auth entries - supports both creation and editing
 * Migrated to GenericForm pattern with nuqs, draft autosave, and contentSections
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

import {
  AuthItemCardGrid,
  type AuthItemCard,
} from "@/components/auth/AuthItemCardGrid";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Lock,
  LockOpen,
  Power,
} from "lucide-react";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Type-only import from server page
import type {
  AuthDetailOut,
  AuthNewOut,
  CreateAuthIn,
  CreateAuthOut,
  PatchAuthDraftIn,
  PatchAuthDraftOut,
  UpdateAuthIn,
  UpdateAuthOut,
} from "@/app/(main)/system/auth/a/[authId]/page";

export interface AuthProps {
  authId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  authDetail?: AuthDetailOut;
  authDetailDefault?: AuthNewOut;
  // Server actions (replaces useMutation)
  createAuthAction?: (input: CreateAuthIn) => Promise<CreateAuthOut>;
  updateAuthAction?: (input: UpdateAuthIn) => Promise<UpdateAuthOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchAuthDraftAction?: (
    input: PatchAuthDraftIn
  ) => Promise<PatchAuthDraftOut>;
}

function AuthComponent({
  authId,
  mode = authId ? "edit" : "create",
  authDetail: serverAuthDetail,
  authDetailDefault: serverAuthDetailDefault,
  createAuthAction,
  updateAuthAction,
  patchAuthDraftAction,
}: AuthProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = mode === "edit" && !!authId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverAuthDetail | typeof serverAuthDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("name" in data && data.name) {
          return `auth:${String(data.name)}`;
        }
        return `new:${JSON.stringify(data).slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const authDetailId = React.useMemo(
    () => stabilizeServerProp(serverAuthDetail),
    [serverAuthDetail, stabilizeServerProp]
  );
  const authDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverAuthDetailDefault),
    [serverAuthDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerAuthDetailRef = React.useRef(serverAuthDetail);
  const latestServerAuthDetailDefaultRef = React.useRef(
    serverAuthDetailDefault
  );

  latestServerAuthDetailRef.current = serverAuthDetail;
  latestServerAuthDetailDefaultRef.current = serverAuthDetailDefault;

  // Use refs to track stable server props
  const stableAuthDetailRef = React.useRef<{
    data: typeof serverAuthDetail;
    id: string | null;
  }>({
    data: serverAuthDetail,
    id: authDetailId,
  });
  const stableAuthDetailDefaultRef = React.useRef<{
    data: typeof serverAuthDetailDefault;
    id: string | null;
  }>({
    data: serverAuthDetailDefault,
    id: authDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableAuthDetailRef.current.id !== authDetailId) {
      stableAuthDetailRef.current = {
        data: latestServerAuthDetailRef.current,
        id: authDetailId,
      };
    }
  }, [authDetailId]);

  React.useEffect(() => {
    if (stableAuthDetailDefaultRef.current.id !== authDetailDefaultId) {
      stableAuthDetailDefaultRef.current = {
        data: latestServerAuthDetailDefaultRef.current,
        id: authDetailDefaultId,
      };
    }
  }, [authDetailDefaultId]);

  // Use stable references
  const authDetail = stableAuthDetailRef.current.data;
  const authDetailDefault = stableAuthDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const authDataId = React.useMemo(() => {
    const data = isEditMode ? authDetail : authDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("name" in data && data.name) {
        return `auth:${String(data.name)}`;
      }
      return `new:${JSON.stringify(data).slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, authDetail, authDetailDefault]);

  const stableAuthDataRef = React.useRef<{
    data: typeof authDetail | typeof authDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? authDetail : authDetailDefault,
    id: authDataId,
  });

  React.useEffect(() => {
    if (stableAuthDataRef.current.id !== authDataId) {
      stableAuthDataRef.current = {
        data: isEditMode ? authDetail : authDetailDefault,
        id: authDataId,
      };
    }
  }, [isEditMode, authDetail, authDetailDefault, authDataId]);

  const authData = stableAuthDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only)
  const authSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    authItemSearch: parseAsString,
    // Filter params (URL-backed)
    authItemShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(authSearchParamsClient, {
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
    name: string;
    description: string;
    active: boolean;
    authItemIds: string[]; // Ordered list of auth item IDs
    authItemActiveStates: Record<string, boolean>; // Active state per item
    authItemEncryptedStates: Record<string, boolean>; // Encrypted state per item
    authItemData: Record<string, { name: string; description: string }>; // Name/description per item
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? authDetail : authDetailDefault;

    if (!data) {
      return {
        name: "",
        description: "",
        active: false,
        authItemIds: [],
        authItemActiveStates: {},
        authItemEncryptedStates: {},
        authItemData: {},
      };
    }

    // Initialize auth item states from server data
    let authItemIds: string[] = [];
    let authItemActiveStates: Record<string, boolean> = {};
    let authItemEncryptedStates: Record<string, boolean> = {};
    let authItemData: Record<string, { name: string; description: string }> =
      {};

    // Try to read from draft payload fields first (if draft exists)
    if (
      data &&
      "auth_item_ids" in data &&
      data.auth_item_ids &&
      typeof data.auth_item_ids === "object"
    ) {
      try {
        const parsed =
          typeof data.auth_item_ids === "string"
            ? JSON.parse(data.auth_item_ids)
            : data.auth_item_ids;
        if (Array.isArray(parsed)) {
          authItemIds = parsed.map(String);
        }
      } catch (e) {
        // Ignore parse errors, fall back to auth_items array
      }
    }

    if (
      data &&
      "auth_item_active_states" in data &&
      data.auth_item_active_states
    ) {
      try {
        const parsed =
          typeof data.auth_item_active_states === "string"
            ? JSON.parse(data.auth_item_active_states)
            : data.auth_item_active_states;
        if (parsed && typeof parsed === "object") {
          authItemActiveStates = parsed as Record<string, boolean>;
        }
      } catch (e) {
        // Ignore parse errors, fall back to auth_items array
      }
    }

    if (
      data &&
      "auth_item_encrypted_states" in data &&
      data.auth_item_encrypted_states
    ) {
      try {
        const parsed =
          typeof data.auth_item_encrypted_states === "string"
            ? JSON.parse(data.auth_item_encrypted_states)
            : data.auth_item_encrypted_states;
        if (parsed && typeof parsed === "object") {
          authItemEncryptedStates = parsed as Record<string, boolean>;
        }
      } catch (e) {
        // Ignore parse errors, fall back to auth_items array
      }
    }

    // If draft payload didn't have these fields, fall back to extracting from auth_items array (edit mode only)
    if (
      authItemIds.length === 0 &&
      isEditMode &&
      authDetail &&
      "auth_items" in authDetail &&
      authDetail.auth_items &&
      Array.isArray(authDetail.auth_items)
    ) {
      // Use ordered auth items from server (by position)
      const sortedItems = [...authDetail.auth_items].sort(
        (a, b) => (a.position || 1) - (b.position || 1)
      );
      sortedItems.forEach((item) => {
        const key = item.auth_item_id;
        if (key) {
          authItemIds.push(key);
          authItemActiveStates[key] = item.active ?? true;
          authItemEncryptedStates[key] = item.encrypted ?? false;
          authItemData[key] = {
            name: item.name || "",
            description: item.description || "",
          };
        }
      });
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      name: data.name || "",
      description: data.description || "",
      active: data.active ?? false,
      authItemIds,
      authItemActiveStates,
      authItemEncryptedStates,
      authItemData,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    authDetail,
    authDetailDefault,
    authDetailId,
    authDetailDefaultId,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    authDetailDefault?.name,
    authDetailDefault?.description,
    authDetailDefault?.active,
    authDetail?.name,
    authDetail?.description,
    authDetail?.active,
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
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      authItemSearch: urlParams.authItemSearch || null,
      authItemShowSelected: urlParams.authItemShowSelected ?? false,
    } as Record<string, unknown>;
  }, [
    draftState,
    urlParams.authItemSearch,
    urlParams.authItemShowSelected,
  ]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
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
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "name" ||
          key === "description" ||
          key === "active" ||
          key === "authItemIds" ||
          key === "authItemActiveStates" ||
          key === "authItemEncryptedStates" ||
          key === "authItemData"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (key === "authItemSearch") {
          // Update URL params for search/filter operations
          urlUpdates["authItemSearch"] =
            (value as string) && (value as string).length > 0
              ? (value as string)
              : null;
        } else if (key === "authItemShowSelected") {
          // Update URL params for filter operations
          urlUpdates["authItemShowSelected"] = value === true ? true : null;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        // Check if URL params actually changed before updating
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  // Draft autosave integration
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchAuthDraftAction
      ? async (input) => {
          // Transform camelCase keys to snake_case for draft payload (SQL expects snake_case)
          const camelToSnake: Record<string, string> = {
            authItemIds: "auth_item_ids",
            authItemActiveStates: "auth_item_active_states",
            authItemEncryptedStates: "auth_item_encrypted_states",
            authItemData: "auth_item_data",
          };
          const transformedPatch: Record<string, unknown> = {};
          Object.entries(input.body.patch as Record<string, unknown>).forEach(
            ([key, value]) => {
              const snakeKey = camelToSnake[key] || key;
              transformedPatch[snakeKey] = value;
            }
          );

          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchAuthDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: transformedPatch,
              expected_version: input.body.expected_version,
            } as PatchAuthDraftIn["body"],
          });
          // Transform response to match hook expectations (API returns draft_id, new_version, draft_exists)
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
        // This ensures the server component gets fresh data with the new draft
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

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !authData) return false;
    return !authData.can_edit;
  }, [isEditMode, authData]);

  // Convert auth items to card format for AuthItemCardGrid
  const authItemCards = useMemo((): AuthItemCard[] => {
    return draftState.authItemIds
      .map((id) => {
        const itemData = draftState.authItemData[id];
        if (!itemData) return null;
        const card: AuthItemCard = {
          id,
          name: itemData.name,
          description: itemData.description,
          encrypted: draftState.authItemEncryptedStates[id] ?? false,
          active: draftState.authItemActiveStates[id] ?? true,
          position: draftState.authItemIds.indexOf(id) + 1,
          isNew: id.startsWith("temp-") || id.startsWith("new-"),
        };
        return card;
      })
      .filter((item): item is AuthItemCard => item !== null);
  }, [draftState]);

  // Handler for card grid changes
  const handleItemsChange = useCallback(
    (items: AuthItemCard[]) => {
      const newAuthItemIds: string[] = [];
      const newAuthItemData: Record<string, { name: string; description: string }> =
        {};
      const newAuthItemActiveStates: Record<string, boolean> = {};
      const newAuthItemEncryptedStates: Record<string, boolean> = {};

      items.forEach((item, index) => {
        newAuthItemIds.push(item.id);
        newAuthItemData[item.id] = {
          name: item.name,
          description: item.description || "",
        };
        newAuthItemActiveStates[item.id] = item.active;
        newAuthItemEncryptedStates[item.id] = item.encrypted;
      });

      setDraftState((prev) => ({
        ...prev,
        authItemIds: newAuthItemIds,
        authItemData: newAuthItemData,
        authItemActiveStates: newAuthItemActiveStates,
        authItemEncryptedStates: newAuthItemEncryptedStates,
      }));
    },
    []
  );

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("name" in serverData)
      ) {
        return {};
      }

      const authDetail = serverData as AuthDetailOut;

      // Initialize auth item states from server data
      const authItemIds: string[] = [];
      const authItemActiveStates: Record<string, boolean> = {};
      const authItemEncryptedStates: Record<string, boolean> = {};
      const authItemData: Record<string, { name: string; description: string }> =
        {};

      if (authDetail.auth_items && Array.isArray(authDetail.auth_items)) {
        const sortedItems = [...authDetail.auth_items].sort(
          (a, b) => (a.position || 1) - (b.position || 1)
        );
        sortedItems.forEach((item) => {
          const key = item.auth_item_id;
          if (key) {
            authItemIds.push(key);
            authItemActiveStates[key] = item.active ?? true;
            authItemEncryptedStates[key] = item.encrypted ?? false;
            authItemData[key] = {
              name: item.name || "",
              description: item.description || "",
            };
          }
        });
      }

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (authDetail.name) draftUpdates.name = authDetail.name;
      if (authDetail.description)
        draftUpdates.description = authDetail.description;
      if (authDetail.active !== undefined)
        draftUpdates.active = authDetail.active ?? false;
      if (authItemIds.length > 0) draftUpdates.authItemIds = authItemIds;
      if (Object.keys(authItemActiveStates).length > 0)
        draftUpdates.authItemActiveStates = authItemActiveStates;
      if (Object.keys(authItemEncryptedStates).length > 0)
        draftUpdates.authItemEncryptedStates = authItemEncryptedStates;
      if (Object.keys(authItemData).length > 0)
        draftUpdates.authItemData = authItemData;

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
      if (!draftState.name?.trim()) {
        toast.error("Auth name is required");
        throw new Error("Auth name is required");
      }

      if (!draftState.description?.trim()) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (draftState.authItemIds.length === 0) {
        toast.error("At least one auth item is required");
        throw new Error("At least one auth item is required");
      }

      // Validate all auth items have name and description
      for (const itemId of draftState.authItemIds) {
        const itemData = draftState.authItemData[itemId];
        if (!itemData || !itemData.name?.trim()) {
          toast.error("All auth items must have a name");
          throw new Error("All auth items must have a name");
        }
        if (!itemData.description?.trim()) {
          toast.error("All auth items must have a description");
          throw new Error("All auth items must have a description");
        }
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      // Generate slug from name (lowercase, replace spaces with hyphens)
      const slug = draftState.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      // Prepare auth items for submission in order specified by authItemIds
      const auth_items = draftState.authItemIds.map((itemId, index) => {
        const itemData = draftState.authItemData[itemId];
        return {
          name: itemData.name,
          description: itemData.description || "",
          encrypted: draftState.authItemEncryptedStates[itemId] ?? false,
          position: index + 1,
          active: draftState.authItemActiveStates[itemId] ?? true,
          key_id: null, // Explicitly set to null for items without keys
        };
      });

      // Extract body types from server action types for type safety
      type CreateAuthBody = CreateAuthIn extends { body: infer B }
        ? B
        : never;
      type UpdateAuthBody = UpdateAuthIn extends { body: infer B }
        ? B
        : never;

      if (isEditMode) {
        if (!updateAuthAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          const updateRequest: UpdateAuthBody = {
            auth_id: authId!,
            name: draftState.name,
            description: draftState.description,
            active: draftState.active ?? false,
          auth_type: "oidc", // Default auth type (required by database)
          slug: slug,
          auth_items,
          };
          await updateAuthAction({ body: updateRequest });
        toast.success("Auth updated successfully!");
          router.push("/system/auth");
        } catch (error) {
          toast.error(
            `Failed to update auth: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createAuthAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          const createRequest: CreateAuthBody = {
            name: draftState.name,
            description: draftState.description,
            active: draftState.active ?? false,
          auth_type: "oidc", // Default auth type (required by database)
          slug: slug,
          auth_items,
          };
          await createAuthAction({ body: createRequest });
        toast.success("Auth created successfully!");
      router.push("/system/auth");
    } catch (error) {
      toast.error(
            `Failed to create auth: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      authId,
      effectiveProfile?.id,
      updateAuthAction,
      createAuthAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();
      const hasItems =
        ((formData["authItemIds"] as string[] | null | undefined) || [])
          .length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "items":
          if (!hasName) return "pending";
          return hasItems ? "completed" : "active";
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
        description: "Set the auth name, description, and active status.",
        resetFields: ["name", "description", "active"] as string[],
      },
      {
        id: "items",
        title: "Auth Items",
        description: "Add and configure auth items.",
        resetFields: [
          "authItemIds",
          "authItemSearch",
          "authItemShowSelected",
        ] as (keyof typeof authSearchParamsClient)[],
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
      "authItemIds",
      "authItemActiveStates",
      "authItemEncryptedStates",
      "authItemData",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "items":
        return "Auth items reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/auth",
      backLabel: "Back",
      createLabel: "Create Auth",
      updateLabel: "Update Auth",
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
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
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
                  (stepFormData["name"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "New Auth",
                defaultName: "New Auth",
                required: true,
              }}
              resetFields={["name", "description", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-auth-description"
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
                  placeholder="Describe this authentication method"
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
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (authData as { active?: boolean })?.active ??
                          false
                        }
                      onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                      }
                      disabled={isReadonly}
                        data-testid="switch-auth-active"
                    />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Enable this authentication method
                </p>
              </div>
            </div>
              </div>
            </StepCard>
          );

        case "items":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "authItemIds",
                "authItemSearch",
                "authItemShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
            <AuthItemCardGrid
              items={authItemCards}
              onItemsChange={handleItemsChange}
              readonly={isReadonly}
            />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [authItemCards, handleItemsChange, isReadonly, isEditMode, authData]
  );

  // Content sections for nested auth item management
  const contentSections = useMemo(() => {
    const authItemIds = draftState.authItemIds || [];
    if (authItemIds.length === 0) {
      return [];
    }

    return [
      {
        id: "active-auth-items",
        insertAfter: "items",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const activeStates =
            (contentFormData["authItemActiveStates"] as
              | Record<string, boolean>
              | null
              | undefined) || {};
          const itemIds =
            (contentFormData["authItemIds"] as string[] | null | undefined) ||
            [];
          const itemData =
            (contentFormData["authItemData"] as
              | Record<string, { name: string; description: string }>
              | null
              | undefined) || {};

              return (
            <StepCard
              stepStatus="completed"
              stepNumber={3}
              stepTitle="Active Auth Items"
              stepDescription="Enable or disable auth items."
              isReadonly={isReadonly}
                  isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemIds.map((itemId) => {
                  const item = itemData[itemId];
                  const active = activeStates[itemId] ?? true;

                  return (
                    <Card key={itemId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {item?.name || "Unnamed Auth Item"}
                          </h3>
                          {item?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${itemId}-active`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${itemId}-active`}
                            checked={active}
                            onCheckedChange={(checked) => {
                              const newActiveStates = {
                                ...activeStates,
                                [itemId]: checked,
                              };
                              setContentFormData({
                                authItemActiveStates: newActiveStates,
                              });
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
              );
            })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "auth-item-positions",
        insertAfter: "items",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const itemIds =
            (contentFormData["authItemIds"] as string[] | null | undefined) ||
            [];
          const itemData =
            (contentFormData["authItemData"] as
              | Record<string, { name: string; description: string }>
              | null
              | undefined) || {};

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Auth Item Positions"
              stepDescription="Reorder auth items to set their display order."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="space-y-2">
                {itemIds.map((itemId, index) => {
                  const item = itemData[itemId];
                  const canMoveUp = index > 0;
                  const canMoveDown = index < itemIds.length - 1;

                  return (
                    <Card key={itemId} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {item?.name || "Unnamed Auth Item"}
                          </h3>
                          {item?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...itemIds];
                              if (index > 0) {
                                const prev = reorderedIds[index - 1];
                                const curr = reorderedIds[index];
                                if (prev !== undefined && curr !== undefined) {
                                  reorderedIds[index - 1] = curr;
                                  reorderedIds[index] = prev;
                                  setContentFormData({
                                    authItemIds: reorderedIds,
                                  });
                                }
                              }
                            }}
                            disabled={!canMoveUp || isReadonly}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...itemIds];
                              if (index < itemIds.length - 1) {
                                const curr = reorderedIds[index];
                                const next = reorderedIds[index + 1];
                                if (curr !== undefined && next !== undefined) {
                                  reorderedIds[index] = next;
                                  reorderedIds[index + 1] = curr;
                                  setContentFormData({
                                    authItemIds: reorderedIds,
                                  });
                                }
                              }
                            }}
                            disabled={!canMoveDown || isReadonly}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
    </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "encrypted-auth-items",
        insertAfter: "items",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const encryptedStates =
            (contentFormData["authItemEncryptedStates"] as
              | Record<string, boolean>
              | null
              | undefined) || {};
          const itemIds =
            (contentFormData["authItemIds"] as string[] | null | undefined) ||
            [];
          const itemData =
            (contentFormData["authItemData"] as
              | Record<string, { name: string; description: string }>
              | null
              | undefined) || {};

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={5}
              stepTitle="Encrypted Auth Items"
              stepDescription="Enable or disable encryption for auth items."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemIds.map((itemId) => {
                  const item = itemData[itemId];
                  const encrypted = encryptedStates[itemId] ?? false;

                  return (
                    <Card key={itemId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {item?.name || "Unnamed Auth Item"}
                          </h3>
                          {item?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${itemId}-encrypted`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            {encrypted ? (
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Label>
                          <Switch
                            id={`${itemId}-encrypted`}
                            checked={encrypted}
                            onCheckedChange={(checked) => {
                              const newEncryptedStates = {
                                ...encryptedStates,
                                [itemId]: checked,
                              };
                              setContentFormData({
                                authItemEncryptedStates: newEncryptedStates,
                              });
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
    ];
  }, [draftState.authItemIds, isReadonly, isEditMode]);

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`auth-${isEditMode ? "edit" : "new"}`}
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
                  Auth is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>This auth entry cannot be edited.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={authSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={authData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
          contentSections={contentSections}
        />
      </div>
    </TooltipProvider>
  );
}

// Helper function to generate stable ID from server prop
function getStableServerPropId(
  data: AuthDetailOut | AuthNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("name" in data && data.name) {
      return `auth:${String(data.name)}`;
    }
    return `new:${JSON.stringify(data).slice(0, 100)}`;
  }
  return String(data);
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(AuthComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.authDetail);
  const nextDetailId = getStableServerPropId(nextProps.authDetail);
  const prevDefaultId = getStableServerPropId(prevProps.authDetailDefault);
  const nextDefaultId = getStableServerPropId(nextProps.authDetailDefault);

  // Compare primitive props
  if (prevProps.authId !== nextProps.authId) {
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
