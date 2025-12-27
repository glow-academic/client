/**
 * Key.tsx
 * Used to create and manage keys for the admin dashboard
 */
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// UI Components
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { cn } from "@/lib/utils";
import { Check, Edit, Eye, EyeOff, Power, X } from "lucide-react";
import { useRouter } from "next/navigation";

// Type-only import from server pages
import type {
  DecryptKeyIn,
  DecryptKeyOut,
  KeyDetailOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/keys/k/[keyId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn as DecryptKeyInNew,
  DecryptKeyOut as DecryptKeyOutNew,
} from "@/app/(main)/system/keys/new/page";

interface FormErrors {
  name?: string;
  key?: string;
  description?: string;
}

interface FormData {
  name?: string;
  key?: string;
  description?: string;
  active?: boolean;
}

export interface KeyProps {
  keyId?: string;
  // For edit mode: key detail
  keyDetail?: KeyDetailOut;
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
  decryptKeyAction?: (
    input: DecryptKeyIn | DecryptKeyInNew,
  ) => Promise<DecryptKeyOut | DecryptKeyOutNew>;
}

export default function Key({
  keyId,
  keyDetail: serverKeyDetail,
  createKeyAction,
  updateKeyAction,
  decryptKeyAction,
}: KeyProps) {
  const router = useRouter();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editingKeyValue, setEditingKeyValue] = useState("");
  const [dotsCount, setDotsCount] = useState(100);
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!keyId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "New Key",
      key: "",
      description: "",
      active: true,
    }),
    [],
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const keyDetail = serverKeyDetail;

  // Extract body types from server action types for type safety
  type CreateKeyBody = CreateKeyIn extends { body: infer B } ? B : never;
  type UpdateKeyBody = UpdateKeyIn extends { body: infer B } ? B : never;

  // Use server actions directly (no mutations needed)
  const handleCreateKey = async (body: CreateKeyBody) => {
    if (!createKeyAction) {
      throw new Error("createKeyAction is required");
    }
    await createKeyAction({ body });
  };

  const handleUpdateKey = async (body: UpdateKeyBody) => {
    if (!updateKeyAction) {
      throw new Error("updateKeyAction is required");
    }
    await updateKeyAction({ body });
  };

  const handleTogglePreview = async () => {
    if (!isPreviewMode) {
      // Turning preview on - need to decrypt
      if (!keyId || !decryptKeyAction) {
        toast.error("Cannot decrypt key: missing required information");
        return;
      }

      setIsDecrypting(true);
      setDecryptedKey(null);

      try {
        const result = await decryptKeyAction({
          body: {
            key_id: keyId,
          },
        });
        setDecryptedKey(result.key);
        setIsPreviewMode(true);
      } catch (error) {
        toast.error(
          `Failed to decrypt key: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsDecrypting(false);
      }
    } else {
      // Turning preview off
      setIsPreviewMode(false);
      setDecryptedKey(null);
    }
  };

  const handleStartEditKey = () => {
    setIsEditingKey(true);
    setEditingKeyValue(formData.key || "");
  };

  const handleSaveEditKey = () => {
    handleInputChange("key", editingKeyValue);
    setIsEditingKey(false);
    setEditingKeyValue("");
  };

  const handleCancelEditKey = () => {
    setIsEditingKey(false);
    setEditingKeyValue("");
  };

  // Check if readonly (default keys without department_ids for non-superadmin)
  const isReadonly = useMemo(() => {
    if (isEditMode && keyDetail) {
      return !keyDetail.can_edit;
    }
    return false;
  }, [isEditMode, keyDetail]);

  // Set breadcrumb context for key (edit mode only)
  useEffect(() => {
    if (keyDetail?.name && keyId && isEditMode) {
      setEntityMetadata({
        entityId: keyId,
        entityName: keyDetail.name,
        entityType: "key",
      });
    }
    return () => {
      if (keyId) {
        clearEntityMetadata(keyId);
      }
    };
  }, [keyDetail, keyId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && keyDetail) {
      // We are in EDIT mode and have the key's data, so populate the form
      setFormData({
        name: keyDetail.name,
        key: "", // Don't populate key value for security
        description: keyDetail.description || "",
        active: keyDetail.active,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, keyDetail, initialFormData]);

  // Calculate dots dynamically based on container width
  useEffect(() => {
    const calculateDots = () => {
      if (!dotsContainerRef.current) return;

      const container = dotsContainerRef.current;
      const containerWidth = container.offsetWidth;
      const padding = 24; // p-3 = 12px on each side
      const availableWidth = containerWidth - padding;

      // Approximate width of a dot character at text-lg (18px)
      // Using a temporary span to measure actual width
      const tempSpan = document.createElement("span");
      tempSpan.style.fontSize = "18px";
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.textContent = "•";
      document.body.appendChild(tempSpan);
      const dotWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);

      // Calculate number of dots that fit, with some spacing
      const dotsNeeded = Math.floor(availableWidth / dotWidth);
      setDotsCount(Math.max(50, dotsNeeded)); // Minimum 50 dots
    };

    calculateDots();

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateDots);
    if (dotsContainerRef.current) {
      resizeObserver.observe(dotsContainerRef.current);
    }

    window.addEventListener("resize", calculateDots);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateDots);
    };
  }, [isEditMode, isEditingKey]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.name.trim()) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

    if (!formData.key && !isEditMode) {
      setErrors((prev) => ({ ...prev, key: "Key value is required" }));
      return;
    }

    if (!formData.key && isEditMode) {
      // In edit mode, if no key provided, we keep the existing one
      // The API handles this case
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && keyId) {
        await handleUpdateKey({
          key_id: keyId,
          name: formData.name!,
          key: formData.key || "", // Use existing key if not changed
          description: formData.description || "",
          active: formData.active ?? true,
          department_ids: null, // Department picker removed
        });
        resetFormAndState();
        toast.success("Key updated successfully!");
        router.push(`/system/keys`);
      } else {
        await handleCreateKey({
          name: formData.name!,
          key: formData.key!,
          description: formData.description || "",
          active: formData.active ?? true,
          department_ids: null, // Department picker removed
        });
        resetFormAndState();
        toast.success("Key created successfully!");
        router.push(`/system/keys`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && keyId ? "update" : "create"} key: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
    }
  };

  // Step status logic
  const getStepStatus = (
    stepId: string,
  ): "pending" | "active" | "completed" => {
    const hasName = !!formData?.name?.trim();

    switch (stepId) {
      case "basic":
        return hasName ? "completed" : "active";
      case "key-value":
        return "active"; // Always available
      default:
        return "pending";
    }
  };

  const basicStepStatus = getStepStatus("basic");

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Basic Information */}
          <Card className="transition-all">
            <CardContent className="pt-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                    basicStepStatus === "completed"
                      ? "bg-green-500 text-white"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {basicStepStatus === "completed" ? (
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
                      data-testid="input-key-name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      onFocus={(e) => {
                        if (e.target.value === "New Key") {
                          e.target.select();
                        }
                      }}
                      onBlur={(e) => {
                        // If empty on blur, revert to default name
                        if (!e.target.value || e.target.value.trim() === "") {
                          handleInputChange("name", "New Key");
                        }
                      }}
                      className={cn(
                        "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                        errors.name && "border-destructive",
                      )}
                      placeholder="New Key"
                      disabled={isReadonly || isSubmitting}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-1 px-2">
                    Click to edit
                  </p>
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1 px-2">
                      {errors.name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardContent className="pt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                {formData?.description !== undefined ? (
                  <Textarea
                    id="description"
                    data-testid="input-key-description"
                    value={formData.description || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Enter a brief description (optional)"
                    rows={3}
                    disabled={isReadonly || isSubmitting}
                  />
                ) : null}
                {errors.description && (
                  <p className="text-sm text-destructive">
                    {errors.description}
                  </p>
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
                        data-testid="switch-key-active"
                        checked={formData.active ?? true}
                        onCheckedChange={(checked) =>
                          handleInputChange("active", checked)
                        }
                        disabled={isReadonly || isSubmitting}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Inactive keys will not be available for selection
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Key Value */}
          <Card className="transition-all">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    "bg-primary text-primary-foreground",
                  )}
                >
                  <span>2</span>
                </div>
                <div>
                  <CardTitle className="text-lg">Key Value</CardTitle>
                  <CardDescription>
                    Enter or update the API key value.
                  </CardDescription>
                </div>
              </div>
              {isEditMode && keyId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleTogglePreview}
                      disabled={isDecrypting || isReadonly || isSubmitting}
                      data-testid="btn-preview-key"
                    >
                      {isDecrypting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      ) : isPreviewMode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPreviewMode ? "Hide Preview" : "Preview Key"}
                  </TooltipContent>
                </Tooltip>
              )}
            </CardHeader>
            <CardContent className="space-y-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                {!isEditMode || isEditingKey ? (
                  <div className="flex items-center gap-2">
                    <Textarea
                      id="key"
                      data-testid="input-key-value"
                      value={
                        isEditingKey ? editingKeyValue : formData.key || ""
                      }
                      onChange={(e) => {
                        if (isEditingKey) {
                          setEditingKeyValue(e.target.value);
                        } else {
                          handleInputChange("key", e.target.value);
                        }
                      }}
                      placeholder="Enter key value"
                      className={cn(
                        "flex-1 h-10 resize-none",
                        errors.key ? "border-destructive" : "",
                      )}
                      disabled={isReadonly || isSubmitting}
                      onKeyDown={(e) => {
                        if (isEditingKey) {
                          if (e.key === "Enter" && e.ctrlKey) {
                            handleSaveEditKey();
                          } else if (e.key === "Escape") {
                            handleCancelEditKey();
                          }
                        }
                      }}
                    />
                    {isEditingKey && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSaveEditKey();
                          }}
                          disabled={isReadonly || isSubmitting}
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCancelEditKey();
                          }}
                          disabled={isReadonly || isSubmitting}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <div
                      ref={dotsContainerRef}
                      className="flex-1 p-3 bg-muted rounded-md border h-10 flex items-center w-full overflow-hidden"
                    >
                      {isPreviewMode && decryptedKey ? (
                        <code className="text-sm break-all w-full">
                          {decryptedKey}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-lg whitespace-nowrap">
                          {"•".repeat(dotsCount)}
                        </span>
                      )}
                    </div>
                    {!isReadonly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleStartEditKey}
                        disabled={isSubmitting}
                        className="shrink-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {errors.key && (
                  <p className="text-sm text-destructive">{errors.key}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          {!isReadonly && (
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                data-testid="btn-submit-key"
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {isEditMode && keyId ? "Updating..." : "Creating..."}
                  </>
                ) : isEditMode && keyId ? (
                  "Update Key"
                ) : (
                  "Create Key"
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </TooltipProvider>
  );
}
