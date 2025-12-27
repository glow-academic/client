/**
 * Auth.tsx
 * Used to create and manage auth entries - supports both creation and editing
 * Refactored to match Simulation.tsx and Rubric.tsx patterns with step status and individual item sections
 */
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AuthItemCardGrid,
  type AuthItemCard,
} from "@/components/auth/AuthItemCardGrid";
import { AuthItemSection } from "@/components/auth/AuthItemSection";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { Check, Power } from "lucide-react";

// Type-only import from server page
import type {
  AuthDetailOut,
  AuthNewOut,
  CreateAuthIn,
  CreateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
} from "@/app/(main)/system/auth/a/[authId]/page";

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

interface FormData {
  name?: string;
  description?: string;
  active?: boolean;
}

interface AuthItemState {
  id: string;
  name: string;
  description: string;
  encrypted: boolean;
  active: boolean;
  position: number;
  isNew: boolean;
  isDeleted: boolean;
}

interface AuthProps {
  authId?: string;
  mode?: "create" | "edit";
  authDetail?: AuthDetailOut;
  authDetailDefault?: AuthNewOut;
  createAuthAction?: (input: CreateAuthIn) => Promise<CreateAuthOut>;
  updateAuthAction?: (input: UpdateAuthIn) => Promise<UpdateAuthOut>;
}

export default function Auth({
  authId,
  mode = authId ? "edit" : "create",
  authDetail: serverAuthDetail,
  authDetailDefault: serverAuthDetailDefault,
  createAuthAction,
  updateAuthAction,
}: AuthProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const isEditMode = mode === "edit" && !!authId;

  // Helper function to update URL with query parameters (only for persisted items)
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      const newParamsString = params.toString();
      router.replace(`${pathname}?${newParamsString}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      active: false,
    }),
    [],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();

  // State for auth item IDs (only persisted items use URL params)
  const [persistedAuthItemIds, setPersistedAuthItemIds] = useState<string[]>(
    [],
  );

  // State for auth item data (id -> AuthItemState)
  // New items (temp-*) are kept in local state only, not in URL params
  const [authItemStates, setAuthItemStates] = useState<
    Record<string, AuthItemState>
  >({});

  // State for accordion (only one section open at a time)
  const [openAccordionItem, setOpenAccordionItem] = useState<string | null>(
    null,
  );

  // Track if we've initialized URL params from server data
  const hasInitializedUrlParamsRef = useRef(false);

  // Use server-provided data
  const authDetail = serverAuthDetail;
  const authDetailDefault = serverAuthDetailDefault;
  const authData = isEditMode ? authDetail : authDetailDefault;

  // Extract body types from server action types for type safety
  type CreateAuthBody = CreateAuthIn extends { body: infer B } ? B : never;
  type UpdateAuthBody = UpdateAuthIn extends { body: infer B } ? B : never;

  // Use server actions directly
  const handleCreateAuth = async (body: CreateAuthBody) => {
    if (!createAuthAction) {
      throw new Error("createAuthAction is required");
    }
    await createAuthAction({ body });
  };

  const handleUpdateAuth = async (body: UpdateAuthBody) => {
    if (!updateAuthAction) {
      throw new Error("updateAuthAction is required");
    }
    await updateAuthAction({ body });
  };

  // Auth items come nested in response
  const authItems = useMemo(() => authData?.auth_items || [], [authData]);

  // Initialize form data from response
  useEffect(() => {
    if (isEditMode && authData) {
      const formDataFromServer = {
        name: authData.name,
        description: authData.description,
        active: authData.active,
      };
      setFormData(formDataFromServer);
    } else if (!isEditMode && authData) {
      setFormData(initialFormData);
    }
  }, [authData, isEditMode, initialFormData]);

  // Initialize auth item states and IDs from server data (only for persisted items)
  useEffect(() => {
    if (isEditMode && authItems && authItems.length > 0) {
      const states: Record<string, AuthItemState> = {};
      const itemIds: string[] = [];

      // Sort by position (from server)
      const sortedItems = [...authItems].sort(
        (a, b) => (a.position || 1) - (b.position || 1),
      );

      sortedItems.forEach((item) => {
        const state: AuthItemState = {
          id: item.auth_item_id,
          name: item.name,
          description: item.description,
          encrypted: item.encrypted ?? false,
          active: item.active ?? true,
          position: item.position || 1,
          isNew: false,
          isDeleted: false,
        };
        states[item.auth_item_id] = state;
        itemIds.push(item.auth_item_id);
      });

      // Merge with existing states (preserve new items that aren't in server data)
      setAuthItemStates((prev) => {
        const merged = { ...prev };
        Object.entries(states).forEach(([id, state]) => {
          merged[id] = state;
        });
        return merged;
      });

      // Only use URL params for persisted items (real IDs from server)
      const itemIdsFromUrlRaw = searchParams.get("authItemIds");
      const itemIdsFromUrl =
        itemIdsFromUrlRaw?.split(",").filter(Boolean) || [];

      // Filter out temp-* IDs from URL (they shouldn't be there)
      const persistedIdsFromUrl = itemIdsFromUrl.filter(
        (id) => !id.startsWith("temp-") && !id.startsWith("new-"),
      );

      const orderedItemIds =
        persistedIdsFromUrl.length > 0 ? persistedIdsFromUrl : itemIds;

      setPersistedAuthItemIds((prev) => {
        const hasChanged =
          prev.length !== orderedItemIds.length ||
          prev.some((id, idx) => id !== orderedItemIds[idx]);
        return hasChanged ? orderedItemIds : prev;
      });

      // Update URL params if we're using server data and URL is empty (only once)
      if (
        !hasInitializedUrlParamsRef.current &&
        persistedIdsFromUrl.length === 0 &&
        orderedItemIds.length > 0
      ) {
        hasInitializedUrlParamsRef.current = true;
        updateUrlParams({
          authItemIds: orderedItemIds,
        });
      }
    }
    // Don't reset state in create mode - preserve new items
  }, [isEditMode, authItems, searchParams, updateUrlParams]);

  // Sync persisted auth item IDs from URL params (only for edit mode)
  useEffect(() => {
    if (!isEditMode) return; // Don't sync URL params in create mode

    const itemIdsFromUrlRaw = searchParams.get("authItemIds");
    const itemIdsFromUrl = itemIdsFromUrlRaw?.split(",").filter(Boolean) || [];

    // Filter out temp-* IDs from URL (they shouldn't be there)
    const persistedIdsFromUrl = itemIdsFromUrl.filter(
      (id) => !id.startsWith("temp-") && !id.startsWith("new-"),
    );

    const arraysEqual =
      persistedIdsFromUrl.length === persistedAuthItemIds.length &&
      persistedIdsFromUrl.every((id, idx) => id === persistedAuthItemIds[idx]);

    if (!arraysEqual) {
      setPersistedAuthItemIds(persistedIdsFromUrl);
    }
  }, [searchParams, isEditMode, persistedAuthItemIds]);

  // Compute all auth item IDs (persisted + new)
  const allAuthItemIds = useMemo(() => {
    const persistedIds = persistedAuthItemIds;
    const newIds = Object.keys(authItemStates).filter(
      (id) => id.startsWith("temp-") || id.startsWith("new-"),
    );
    return [...persistedIds, ...newIds];
  }, [persistedAuthItemIds, authItemStates]);

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!authData) return true;
    return !authData.can_edit;
  }, [isEditMode, authData]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();
      const hasItems = allAuthItemIds.length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "items":
          if (!hasName) return "pending";
          return hasItems ? "completed" : "active";
        default:
          // Handle individual auth item steps
          if (stepId.startsWith("authItem-")) {
            return hasItems ? "completed" : "pending";
          }
          return "pending";
      }
    },
    [formData?.name, allAuthItemIds],
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the auth name, description, and active status.",
        status: getStepStatus("basic"),
      },
      {
        id: "items",
        title: "Auth Items",
        description: "Add and configure auth items.",
        status: getStepStatus("items"),
      },
    ];
  }, [getStepStatus]);

  // Handler for card grid changes
  const handleItemsChange = useCallback(
    (items: AuthItemCard[]) => {
      const states: Record<string, AuthItemState> = {};
      const persistedIds: string[] = [];

      items.forEach((item, index) => {
        states[item.id] = {
          id: item.id,
          name: item.name,
          description: item.description || "",
          encrypted: item.encrypted,
          active: item.active,
          position: index + 1,
          isNew: item.isNew,
          isDeleted: false,
        };

        // Only add persisted items (real IDs) to URL params
        if (!item.id.startsWith("temp-") && !item.id.startsWith("new-")) {
          persistedIds.push(item.id);
        }
      });

      setAuthItemStates(states);

      // Only update URL params for persisted items in edit mode
      if (isEditMode && persistedIds.length > 0) {
        setPersistedAuthItemIds(persistedIds);
        updateUrlParams({
          authItemIds: persistedIds.length > 0 ? persistedIds : null,
        });
      } else if (isEditMode) {
        // Clear URL params if no persisted items
        setPersistedAuthItemIds([]);
        updateUrlParams({
          authItemIds: null,
        });
      }
    },
    [isEditMode, updateUrlParams],
  );

  // Convert authItemStates to card format
  const authItemCards = useMemo((): AuthItemCard[] => {
    return allAuthItemIds
      .map((id) => {
        const item = authItemStates[id];
        if (!item || item.isDeleted) return null;
        const card: AuthItemCard = {
          id: item.id,
          name: item.name,
          description: item.description,
          encrypted: item.encrypted,
          active: item.active,
          position: item.position,
          isNew: item.isNew,
        };
        return card;
      })
      .filter((item): item is AuthItemCard => item !== null)
      .sort((a, b) => a.position - b.position);
  }, [allAuthItemIds, authItemStates]);

  // Compute ordered auth items for accordion display
  const orderedAuthItems = useMemo(() => {
    return allAuthItemIds
      .map((id) => {
        const item = authItemStates[id];
        if (!item || item.isDeleted) return null;
        return item;
      })
      .filter((item): item is AuthItemState => item !== null)
      .sort((a, b) => a.position - b.position);
  }, [allAuthItemIds, authItemStates]);

  // Handlers for auth item changes
  const handleAuthItemNameChange = useCallback(
    (authItemId: string, name: string) => {
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        if (updated[authItemId]) {
          updated[authItemId] = { ...updated[authItemId]!, name };
        }
        return updated;
      });
    },
    [],
  );

  const handleAuthItemDescriptionChange = useCallback(
    (authItemId: string, description: string) => {
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        if (updated[authItemId]) {
          updated[authItemId] = { ...updated[authItemId]!, description };
        }
        return updated;
      });
    },
    [],
  );

  const handleAuthItemActiveToggle = useCallback(
    (authItemId: string, active: boolean) => {
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        if (updated[authItemId]) {
          updated[authItemId] = { ...updated[authItemId]!, active };
        }
        return updated;
      });
    },
    [],
  );

  const handleAuthItemEncryptedToggle = useCallback(
    (authItemId: string, encrypted: boolean) => {
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        if (updated[authItemId]) {
          updated[authItemId] = { ...updated[authItemId]!, encrypted };
        }
        return updated;
      });
    },
    [],
  );

  // Position handlers for auth items
  const handleAuthItemMoveUp = useCallback(
    (authItemId: string) => {
      const orderedIds = searchParams
        .get("authItemIds")
        ?.split(",")
        .filter(Boolean) || [...persistedAuthItemIds];

      const index = orderedIds.indexOf(authItemId);
      if (index <= 0) {
        // Handle new items (temp-*)
        const allIds = [
          ...persistedAuthItemIds,
          ...Object.keys(authItemStates).filter(
            (id) => id.startsWith("temp-") || id.startsWith("new-"),
          ),
        ];
        const newIndex = allIds.indexOf(authItemId);
        if (newIndex <= 0) return;

        const reorderedIds = [...allIds];
        const prevItem = reorderedIds[newIndex - 1];
        const currItem = reorderedIds[newIndex];
        if (prevItem && currItem) {
          reorderedIds[newIndex - 1] = currItem;
          reorderedIds[newIndex] = prevItem;
        }

        // Update positions
        setAuthItemStates((prev) => {
          const updated = { ...prev };
          reorderedIds.forEach((id, idx) => {
            if (updated[id]) {
              updated[id] = { ...updated[id]!, position: idx + 1 };
            }
          });
          return updated;
        });
        return;
      }

      // Swap with previous item
      const reorderedIds = [...orderedIds];
      const prevItem = reorderedIds[index - 1];
      const currItem = reorderedIds[index];
      if (prevItem && currItem) {
        reorderedIds[index - 1] = currItem;
        reorderedIds[index] = prevItem;
      }

      // Update positions
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        reorderedIds.forEach((id, idx) => {
          if (updated[id]) {
            updated[id] = { ...updated[id]!, position: idx + 1 };
          }
        });
        return updated;
      });

      // Update URL params for persisted items
      const persistedIds = reorderedIds.filter(
        (id) => !id.startsWith("temp-") && !id.startsWith("new-"),
      );
      setPersistedAuthItemIds(persistedIds);
      updateUrlParams({
        authItemIds: persistedIds.length > 0 ? persistedIds : null,
      });
    },
    [persistedAuthItemIds, authItemStates, searchParams, updateUrlParams],
  );

  const handleAuthItemMoveDown = useCallback(
    (authItemId: string) => {
      const orderedIds = searchParams
        .get("authItemIds")
        ?.split(",")
        .filter(Boolean) || [...persistedAuthItemIds];

      const index = orderedIds.indexOf(authItemId);
      if (index < 0 || index >= orderedIds.length - 1) {
        // Handle new items (temp-*)
        const allIds = [
          ...persistedAuthItemIds,
          ...Object.keys(authItemStates).filter(
            (id) => id.startsWith("temp-") || id.startsWith("new-"),
          ),
        ];
        const newIndex = allIds.indexOf(authItemId);
        if (newIndex < 0 || newIndex >= allIds.length - 1) return;

        const reorderedIds = [...allIds];
        const currItem = reorderedIds[newIndex];
        const nextItem = reorderedIds[newIndex + 1];
        if (currItem && nextItem) {
          reorderedIds[newIndex] = nextItem;
          reorderedIds[newIndex + 1] = currItem;
        }

        // Update positions
        setAuthItemStates((prev) => {
          const updated = { ...prev };
          reorderedIds.forEach((id, idx) => {
            if (updated[id]) {
              updated[id] = { ...updated[id]!, position: idx + 1 };
            }
          });
          return updated;
        });
        return;
      }

      // Swap with next item
      const reorderedIds = [...orderedIds];
      const currItem = reorderedIds[index];
      const nextItem = reorderedIds[index + 1];
      if (currItem && nextItem) {
        reorderedIds[index] = nextItem;
        reorderedIds[index + 1] = currItem;
      }

      // Update positions
      setAuthItemStates((prev) => {
        const updated = { ...prev };
        reorderedIds.forEach((id, idx) => {
          if (updated[id]) {
            updated[id] = { ...updated[id]!, position: idx + 1 };
          }
        });
        return updated;
      });

      // Update URL params for persisted items
      const persistedIds = reorderedIds.filter(
        (id) => !id.startsWith("temp-") && !id.startsWith("new-"),
      );
      setPersistedAuthItemIds(persistedIds);
      updateUrlParams({
        authItemIds: persistedIds.length > 0 ? persistedIds : null,
      });
    },
    [persistedAuthItemIds, authItemStates, searchParams, updateUrlParams],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData) {
      toast.error("Form data is not available");
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(`Validation errors: ${errors.join(", ")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare auth items for submission
      const auth_items = authItemCards.map((item, index) => ({
        name: item.name,
        description: item.description || "",
        encrypted: item.encrypted,
        position: index + 1,
        active: item.active,
        key_id: null, // Explicitly set to null for items without keys (per note #2)
      }));

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      // Generate slug from name (lowercase, replace spaces with hyphens)
      const slug = formData.name!
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      if (isEditMode) {
        await handleUpdateAuth({
          authId: authId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          auth_type: "oidc", // Default auth type (required by database)
          slug: slug,
          auth_items,
        });

        toast.success("Auth updated successfully!");
      } else {
        await handleCreateAuth({
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          auth_type: "oidc", // Default auth type (required by database)
          slug: slug,
          auth_items,
        });

        toast.success("Auth created successfully!");
      }

      router.push("/system/auth");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} auth: ${error}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData?.name || formData.name.trim() === "") {
      errors.push("Name is required");
    }

    if (!formData?.description || formData.description.trim() === "") {
      errors.push("Description is required");
    }

    // Validate auth items
    if (authItemCards.length === 0) {
      errors.push("At least one auth item is required");
    }

    for (const item of authItemCards) {
      if (!item.name || item.name.trim() === "") {
        errors.push("All auth items must have a name");
        break;
      }
      if (!item.description || item.description.trim() === "") {
        errors.push("All auth items must have a description");
        break;
      }
    }

    return errors;
  };

  return (
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
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  steps[0]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[0]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {steps[0]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="flex-1">
                {formData?.name !== undefined ? (
                  <input
                    type="text"
                    id="name"
                    data-testid="input-auth-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    onFocus={(e) => {
                      if (e.target.value === "") {
                        e.target.select();
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.target.value || e.target.value.trim() === "") {
                        setFormData((prev) => ({ ...prev, name: "" }));
                      }
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                    )}
                    placeholder="New Auth"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  Click to edit
                </p>
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-auth-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe this authentication method"
                  rows={3}
                  disabled={isReadonly}
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
                      data-testid="switch-auth-active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, active: checked }))
                      }
                      disabled={isReadonly}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Enable this authentication method
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Auth Items Selection */}
        <Card
          className={cn(
            "transition-all",
            !isEditMode &&
              steps[1]?.status === "active" &&
              "ring-2 ring-primary",
            !isEditMode && steps[1]?.status === "pending" && "opacity-50",
          )}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  steps[1]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[1]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {steps[1]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[1]?.title || "Auth Items"}
                </CardTitle>
                <CardDescription>
                  {steps[1]?.description || "Add and configure auth items."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6">
            <AuthItemCardGrid
              items={authItemCards}
              onItemsChange={handleItemsChange}
              readonly={isReadonly}
            />
          </CardContent>
        </Card>

        {/* Individual Auth Item Configuration Steps */}
        {orderedAuthItems.length > 0 && (
          <Accordion
            type="single"
            collapsible
            {...(openAccordionItem ? { value: openAccordionItem } : {})}
            onValueChange={(value) => setOpenAccordionItem(value || null)}
            className="space-y-4"
          >
            {orderedAuthItems.map((item) => {
              const accordionValue = `authItem:${item.id}`;
              const stepId = `authItem-${item.id}`;
              return (
                <AuthItemSection
                  key={item.id}
                  authItemId={item.id}
                  name={item.name}
                  description={item.description}
                  position={item.position}
                  totalItems={orderedAuthItems.length}
                  active={item.active}
                  encrypted={item.encrypted}
                  isNew={item.isNew}
                  onNameChange={handleAuthItemNameChange}
                  onDescriptionChange={handleAuthItemDescriptionChange}
                  onActiveToggle={handleAuthItemActiveToggle}
                  onEncryptedToggle={handleAuthItemEncryptedToggle}
                  onMoveUp={handleAuthItemMoveUp}
                  onMoveDown={handleAuthItemMoveDown}
                  readonly={isReadonly}
                  stepStatus={getStepStatus(stepId)}
                  stepNumber={item.position + 2} // After basic (1), items (2)
                  isEditMode={isEditMode}
                  accordionValue={accordionValue}
                  isAccordionOpen={openAccordionItem === accordionValue}
                  onAccordionToggle={(open) =>
                    setOpenAccordionItem(open ? accordionValue : null)
                  }
                />
              );
            })}
          </Accordion>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/system/auth")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isReadonly}>
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Auth"
                : "Create Auth"}
          </Button>
        </div>
      </form>
    </div>
  );
}
