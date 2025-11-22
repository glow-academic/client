/**
 * Auth.tsx
 * Used to create and manage auth entries - supports both creation and editing
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { KeyPicker } from "@/components/common/forms/KeyPicker";
import { Button } from "@/components/ui/button";
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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { Power, Plus, Trash2 } from "lucide-react";

// Type-only import from server page
import type {
  CreateAuthIn,
  CreateAuthOut,
  AuthDetailDefaultOut,
  AuthDetailOut,
  UpdateAuthIn,
  UpdateAuthOut,
} from "@/app/(main)/system/authentication/a/[authId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
} from "@/app/(main)/system/authentication/page";
import { api } from "@/lib/api/client";

type AuthItemFormData = {
  id?: string;
  name: string;
  description: string;
  key_ids: string[];
  isNew: boolean;
  isDeleted: boolean;
};

interface FormData {
  name?: string;
  description?: string;
  active?: boolean;
}

interface AuthProps {
  authId?: string;
  mode?: "create" | "edit";
  authDetail?: AuthDetailOut;
  authDetailDefault?: AuthDetailDefaultOut;
  createAuthAction?: (input: CreateAuthIn) => Promise<CreateAuthOut>;
  updateAuthAction?: (input: UpdateAuthIn) => Promise<UpdateAuthOut>;
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
}

export default function Auth({
  authId,
  mode = authId ? "edit" : "create",
  authDetail: serverAuthDetail,
  authDetailDefault: serverAuthDetailDefault,
  createAuthAction,
  updateAuthAction,
  createKeyAction,
}: AuthProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!authId;
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

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
  const [authItemsFormData, setAuthItemsFormData] = useState<
    AuthItemFormData[]
  >([]);
  const [keyMapping, setKeyMapping] = useState<
    Record<string, { key_masked: string; active: boolean }>
  >({});
  const [validKeyIds, setValidKeyIds] = useState<string[]>([]);

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

  // Load keys list
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const response = await api.post("/keys/list", {
          body: { type: "auth" },
        });
        setKeyMapping(response.key_mapping || {});
        setValidKeyIds(response.keys.map((k) => k.key_id));
      } catch (error) {
        console.error("Failed to load keys:", error);
      }
    };
    loadKeys();
  }, []);

  // Set breadcrumb context when auth data is loaded
  useEffect(() => {
    if (authDetail?.name && authId && isEditMode) {
      setEntityMetadata({
        entityId: authId,
        entityName: authDetail.name,
        entityType: "auth",
      });
    }
    return () => clearEntityMetadata();
  }, [
    authDetail,
    authId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Auth items come nested in response
  const authItems = useMemo(
    () => authData?.auth_items || [],
    [authData],
  );

  const [initiallySorted, setInitiallySorted] = useState(false);

  // Initialize form data from response
  useEffect(() => {
    if (isEditMode && authData) {
      setFormData({
        name: authData.name,
        description: authData.description,
        active: authData.active,
      });
      // Update key mapping from auth detail
      if (authData.key_mapping) {
        setKeyMapping(authData.key_mapping);
      }
    } else if (!isEditMode && authData) {
      setFormData({
        ...initialFormData,
      });
    }
  }, [authData, isEditMode, initialFormData]);

  // Initialize auth items from nested data
  useEffect(() => {
    if (!initiallySorted && authItems && authItems.length > 0) {
      const sorted = authItems
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const formData = sorted.map((item) => ({
        id: item.auth_item_id,
        name: item.name,
        description: item.description,
        key_ids: item.key_ids || [],
        isNew: false,
        isDeleted: false,
      }));
      setAuthItemsFormData(formData);
      setInitiallySorted(true);
    }
  }, [initiallySorted, authItems]);

  // Update auth items when data changes (for edit mode)
  useEffect(() => {
    if (mode === "create") {
      return;
    }
    if (!authItems) return;
    if (!initiallySorted) return;

    const mapped = authItems
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        id: item.auth_item_id,
        name: item.name,
        description: item.description,
        key_ids: item.key_ids || [],
        isNew: false,
        isDeleted: false,
      }));
    setAuthItemsFormData(mapped);
  }, [authItems, mode, initiallySorted]);

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
      // Prepare auth items for submission (only non-deleted items)
      const auth_items = authItemsFormData
        .filter((item) => !item.isDeleted)
        .map((item) => ({
          name: item.name,
          description: item.description,
          key_ids: item.key_ids.length > 0 ? item.key_ids : null,
        }));

      if (isEditMode) {
        await handleUpdateAuth({
          authId: authId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          auth_items,
        });

        toast.success("Auth updated successfully!");
      } else {
        await handleCreateAuth({
          name: formData.name!,
          description: formData.description!,
          active: formData.active || false,
          auth_items,
        });

        toast.success("Auth created successfully!");
      }

      router.push("/system/authentication");
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
    const nonDeletedItems = authItemsFormData.filter((item) => !item.isDeleted);
    if (nonDeletedItems.length === 0) {
      errors.push("At least one auth item is required");
    }

    for (const item of nonDeletedItems) {
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

  const handleAddAuthItem = () => {
    setAuthItemsFormData((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        key_ids: [],
        isNew: true,
        isDeleted: false,
      },
    ]);
  };

  const handleDeleteAuthItem = (index: number) => {
    setAuthItemsFormData((prev) => {
      const newItems = [...prev];
      if (newItems[index]?.isNew) {
        newItems.splice(index, 1);
      } else {
        newItems[index] = { ...newItems[index]!, isDeleted: true };
      }
      return newItems;
    });
  };

  const handleAuthItemInputChange = (
    index: number,
    field: keyof AuthItemFormData,
    value: string | string[],
  ) => {
    setAuthItemsFormData((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index]!, [field]: value };
      return newItems;
    });
  };

  const isReadonly =
    isEditMode && authDetail && !authDetail.can_edit;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Name *
            </Label>
            <Input
              id="name"
              value={formData?.name || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Authentication method name"
              disabled={isReadonly}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description *
            </Label>
            <Textarea
              id="description"
              value={formData?.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe this authentication method"
              disabled={isReadonly}
              className="mt-1 min-h-[100px]"
              rows={4}
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
        </div>

        {/* Auth Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              type="button"
              onClick={handleAddAuthItem}
              size="sm"
              variant="default"
              data-testid="btn-add-auth-item"
              className="w-full sm:w-auto"
              disabled={isReadonly}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          </div>

          {authItemsFormData.some((i) => !i.isDeleted) ? (
            <>
              {/* Mobile: Stacked card view */}
              <div className="md:hidden space-y-4">
                {authItemsFormData.map((item, itemIndex) =>
                  item.isDeleted ? null : (
                    <div
                      key={item.id || `new-${itemIndex}`}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              handleAuthItemInputChange(
                                itemIndex,
                                "name",
                                e.target.value,
                              )
                            }
                            className="text-sm font-medium w-full"
                            placeholder="Item name"
                            disabled={isReadonly}
                          />
                        </div>
                        {!isReadonly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAuthItem(itemIndex)}
                            aria-label="Delete auth item"
                            className="h-8 w-8 p-0 flex-shrink-0"
                            data-testid="btn-delete-auth-item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Textarea
                          value={item.description}
                          onChange={(e) =>
                            handleAuthItemInputChange(
                              itemIndex,
                              "description",
                              e.target.value,
                            )
                          }
                          className="text-sm min-h-[80px] w-full"
                          rows={3}
                          placeholder="Item description"
                          disabled={isReadonly}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Keys
                        </Label>
                        <KeyPicker
                          mapping={keyMapping}
                          validIds={validKeyIds}
                          selectedIds={item.key_ids}
                          onSelect={(ids) =>
                            handleAuthItemInputChange(
                              itemIndex,
                              "key_ids",
                              ids,
                            )
                          }
                          multiSelect={true}
                          disabled={isReadonly}
                          createKeyAction={createKeyAction}
                          keyType="auth"
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Desktop: Table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Name</TableHead>
                      <TableHead className="w-80">Description</TableHead>
                      <TableHead className="w-64">Keys</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authItemsFormData.map((item, itemIndex) =>
                      item.isDeleted ? null : (
                        <TableRow key={item.id || `new-${itemIndex}`}>
                          <TableCell className="w-48">
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleAuthItemInputChange(
                                  itemIndex,
                                  "name",
                                  e.target.value,
                                )
                              }
                              className="text-sm w-full"
                              placeholder="Item name"
                              disabled={isReadonly}
                            />
                          </TableCell>
                          <TableCell className="w-80">
                            <Textarea
                              value={item.description}
                              onChange={(e) =>
                                handleAuthItemInputChange(
                                  itemIndex,
                                  "description",
                                  e.target.value,
                                )
                              }
                              className="text-sm min-h-[60px] w-full"
                              rows={2}
                              placeholder="Item description"
                              disabled={isReadonly}
                            />
                          </TableCell>
                          <TableCell className="w-64">
                            <KeyPicker
                              mapping={keyMapping}
                              validIds={validKeyIds}
                              selectedIds={item.key_ids}
                              onSelect={(ids) =>
                                handleAuthItemInputChange(
                                  itemIndex,
                                  "key_ids",
                                  ids,
                                )
                              }
                              multiSelect={true}
                              disabled={isReadonly}
                              createKeyAction={createKeyAction}
                              keyType="auth"
                              compact={true}
                            />
                          </TableCell>
                          <TableCell className="w-20">
                            {!isReadonly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAuthItem(itemIndex)}
                                aria-label="Delete auth item"
                                className="h-8 w-8 p-0"
                                data-testid="btn-delete-auth-item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No auth items yet. Click "Add Item" to get started.
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/system/authentication")}
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

