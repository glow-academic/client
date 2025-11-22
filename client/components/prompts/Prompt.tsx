/**
 * Prompt.tsx
 * Form component for creating and editing prompts
 * @AshokSaravanan222
 * 01/22/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import UnifiedPromptEditor from "@/components/common/editor/UnifiedPromptEditor";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Power } from "lucide-react";

import type {
  CreatePromptIn,
  CreatePromptOut,
  PromptDetailDefaultIn,
  PromptDetailDefaultOut,
  PromptDetailIn,
  PromptDetailOut,
  UpdatePromptIn,
  UpdatePromptOut,
} from "@/app/(main)/engine/prompts/p/[promptId]/page";

interface FormData {
  name: string;
  description: string;
  systemPrompt: string;
  active: boolean;
  departmentIds: string[] | null;
}

interface PromptProps {
  promptId?: string;
  mode?: "create" | "edit";
  promptDetail?: PromptDetailOut;
  promptDetailDefault?: PromptDetailDefaultOut;
  createPromptAction?: (
    input: CreatePromptIn
  ) => Promise<CreatePromptOut>;
  updatePromptAction?: (
    input: UpdatePromptIn
  ) => Promise<UpdatePromptOut>;
}

export default function Prompt({
  promptId,
  mode = promptId ? "edit" : "create",
  promptDetail: serverPromptDetail,
  promptDetailDefault: serverPromptDetailDefault,
  createPromptAction,
  updatePromptAction,
}: PromptProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!promptId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      active: true,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();
  const [editorMode, setEditorMode] = useState<"editor" | "preview">(
    "editor"
  );

  // Use server-provided data directly
  const promptDetail = serverPromptDetail;
  const promptDetailDefault = serverPromptDetailDefault;
  const promptData = isEditMode ? promptDetail : promptDetailDefault;

  // Extract body types for type safety
  type CreatePromptBody = CreatePromptIn extends { body: infer B }
    ? B
    : never;
  type UpdatePromptBody = UpdatePromptIn extends { body: infer B }
    ? B
    : never;

  // Server action handlers
  const handleCreatePrompt = async (body: CreatePromptBody) => {
    if (!createPromptAction) {
      throw new Error("createPromptAction is required");
    }
    await createPromptAction({ body });
  };

  const handleUpdatePrompt = async (body: UpdatePromptBody) => {
    if (!updatePromptAction) {
      throw new Error("updatePromptAction is required");
    }
    await updatePromptAction({ body });
  };

  // Readonly logic using permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !promptData) return false;
    return !promptData.can_edit;
  }, [isEditMode, promptData]);

  // Extract mappings from v3 response
  const departmentMapping = useMemo(
    () =>
      (promptData?.department_mapping || {}) as Record<
        string,
        { name: string; description: string }
      >,
    [promptData]
  );

  const validDepartmentIds = useMemo(
    () => promptData?.valid_department_ids || [],
    [promptData]
  );

  // Initialize form data from v3 response
  useEffect(() => {
    if (isEditMode && promptData) {
      setFormData({
        name: promptData.name || "",
        description: promptData.description || "",
        systemPrompt: promptData.system_prompt || "",
        active: promptData.active ?? true,
        departmentIds: promptData.department_ids || null,
      });
    } else if (!isEditMode && promptData) {
      // For create mode, use defaults from the API response
      setFormData({
        ...initialFormData,
        systemPrompt: promptData.system_prompt || "",
        departmentIds: promptData.department_ids || defaultDepartmentIds,
      });
    }
  }, [promptData, isEditMode, initialFormData, defaultDepartmentIds]);

  // Set breadcrumb context when prompt data is loaded
  useEffect(() => {
    if (promptDetail?.name && promptId && isEditMode) {
      setEntityMetadata({
        entityId: promptId,
        entityName: promptDetail.name,
        entityType: "prompt",
      });
    }
    return () => clearEntityMetadata();
  }, [
    promptDetail,
    promptId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData?.name || !formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData?.systemPrompt || !formData.systemPrompt.trim()) {
      toast.error("System prompt is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        await handleUpdatePrompt({
          promptId: promptId!,
          name: formData.name,
          description: formData.description || "",
          system_prompt: formData.systemPrompt,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        toast.success("Prompt updated successfully");
      } else {
        await handleCreatePrompt({
          name: formData.name,
          description: formData.description || "",
          system_prompt: formData.systemPrompt,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
        });
        toast.success("Prompt created successfully");
      }
      router.push("/engine/prompts");
      router.refresh();
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} prompt: ${err.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/engine/prompts");
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : undefined));
  };

  if (!formData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter prompt name"
              disabled={isReadonly}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter prompt description"
              disabled={isReadonly}
              className="mt-1 min-h-[80px]"
              rows={3}
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
                {formData.active !== undefined ? (
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                    disabled={isReadonly}
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Inactive prompts will not be available for selection
              </p>
            </div>
          </div>
        </div>

        {/* System Prompt Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={editorMode === "editor" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditorMode("editor")}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant={editorMode === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditorMode("preview")}
              >
                Preview
              </Button>
            </div>
          </div>
          <div className="h-[500px]" data-testid="editor-system-prompt">
            <UnifiedPromptEditor
              value={formData.systemPrompt || ""}
              onChange={(value) => {
                handleInputChange("systemPrompt", value);
              }}
              placeholder="System prompt that defines how agents and personas should behave and respond. You can use markdown formatting."
              disabled={isReadonly}
              className="h-full"
              activeMode={editorMode}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This prompt defines the behavior and personality for agents and
            personas in conversations. You can use markdown formatting for
            better organization.
          </p>
        </div>

        {/* Department Selection */}
        {validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <DepartmentPicker
              mapping={departmentMapping}
              validIds={validDepartmentIds}
              selectedIds={formData.departmentIds || []}
              onSelect={(ids) =>
                handleInputChange("departmentIds", ids.length > 0 ? ids : null)
              }
              placeholder="All Departments"
              disabled={isReadonly}
              multiSelect={true}
              triggerProps={{ "data-testid": "picker-department" }}
            />
            <p className="text-sm text-muted-foreground">
              Select departments that can access this prompt. Leave empty for
              all departments (default prompt).
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {!isReadonly && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Prompt"
                  : "Create Prompt"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

