/**
 * Policy.tsx
 * Policy creation and editing component
 * @AshokSaravanan222 & @siladiea
 * 12/24/2024
 */
"use client";
import { Power, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// Custom Components
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";

// Types and API functions
import type {
  CreatePolicyIn,
  CreatePolicyOut,
  UpdatePolicyIn,
  UpdatePolicyOut,
  FinalizePolicyUploadIn,
  FinalizePolicyUploadOut,
} from "@/app/(main)/management/policies/p/[policyId]/page";
import type { PolicyDetailOut } from "@/app/(main)/management/policies/p/[policyId]/page";

export interface PolicyProps {
  mode?: "create" | "edit";
  policyId?: string;
  policyDetail?: PolicyDetailOut;
  policyDetailDefault?: PolicyDetailOut;
  createPolicyAction?: (input: CreatePolicyIn) => Promise<CreatePolicyOut>;
  updatePolicyAction?: (input: UpdatePolicyIn) => Promise<UpdatePolicyOut>;
  finalizePolicyUploadAction?: (
    input: FinalizePolicyUploadIn
  ) => Promise<FinalizePolicyUploadOut>;
}

export default function Policy({
  mode = "create",
  policyId,
  policyDetail: serverPolicyDetail,
  policyDetailDefault: serverPolicyDetailDefault,
  createPolicyAction,
  updatePolicyAction,
  finalizePolicyUploadAction,
}: PolicyProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!policyId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Use server-provided data directly
  const policyDetail = serverPolicyDetail;
  const policyDetailDefault = serverPolicyDetailDefault;

  // Use edit detail when editing, default detail when creating
  const policyData = isEditMode ? policyDetail : policyDetailDefault;

  // Set breadcrumb context when policy data is loaded
  useEffect(() => {
    if (policyDetail?.name && policyId && isEditMode) {
      setEntityMetadata({
        entityId: policyId,
        entityName: policyDetail.name,
        entityType: "policy",
      });
    }
    return () => clearEntityMetadata();
  }, [
    policyDetail,
    policyId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types for type safety
  type CreatePolicyBody = CreatePolicyIn extends { body: infer B } ? B : never;
  type UpdatePolicyBody = UpdatePolicyIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreatePolicy = async (body: CreatePolicyBody) => {
    if (!createPolicyAction) {
      throw new Error("createPolicyAction is required");
    }
    return await createPolicyAction({ body });
  };

  const handleUpdatePolicy = async (body: UpdatePolicyBody) => {
    if (!updatePolicyAction) {
      throw new Error("updatePolicyAction is required");
    }
    return await updatePolicyAction({ body });
  };

  // Form data state
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  type FormData = {
    name: string;
    description: string;
    departmentIds: string[];
    active: boolean;
  };

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      departmentIds: defaultDepartmentIds,
      active: true,
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formDataInitializedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Department mapping
  const departmentMapping = useMemo(
    () => policyData?.department_mapping || {},
    [policyData?.department_mapping]
  );

  const validDepartmentIds = useMemo(
    () => policyData?.valid_department_ids || [],
    [policyData?.valid_department_ids]
  );

  // Load policy data from server response
  useEffect(() => {
    if (policyData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing policy data (only once)
      const deptIds = policyData.department_ids || [];
      setFormData({
        name: policyData.name,
        description: policyData.description,
        departmentIds: deptIds,
        active: policyData.active ?? true,
      });
      formDataInitializedRef.current = true;
    } else if (!isEditMode && !formDataInitializedRef.current) {
      // Create mode: initialize with defaults
      setFormData(initialFormData);
      formDataInitializedRef.current = true;
    }
  }, [policyData, isEditMode, initialFormData]);

  const handleInputChange = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const inferMimeFromName = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };
    return mimeMap[ext || ""] || "application/octet-stream";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }

    if (!formData.description.trim()) {
      setErrors({ description: "Description is required" });
      return;
    }

    // For create mode, require file upload
    if (!isEditMode && !selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        // Update existing policy
        const deptIds = transformDepartmentIdsForSubmit(
          formData.departmentIds,
          isSuperadmin
        );

        await handleUpdatePolicy({
          policyId: policyId!,
          name: formData.name,
          description: formData.description,
          active: formData.active,
          departmentIds: deptIds,
        });

        toast.success("Policy updated successfully");
        router.refresh();
      } else {
        // Create new policy - upload file first, then finalize
        if (!selectedFile || !finalizePolicyUploadAction) {
          throw new Error("File upload is required for new policies");
        }

        const fileId = uuidv4();
        setIsUploading(true);

        // Create TUS upload
        const upload = new tus.Upload(selectedFile, {
          endpoint: `/api/policies/upload`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: {
            filename: selectedFile.name,
            filetype: selectedFile.type || inferMimeFromName(selectedFile.name),
            fileId: fileId,
          },
          onError: (error) => {
            toast.error(`Upload failed: ${selectedFile.name}`, {
              description: error.message || "An error occurred during upload",
            });
            setIsUploading(false);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            setUploadProgress(progress);
          },
          onSuccess: async () => {
            // Finalize the upload after TUS upload completes
            try {
              const deptIds = transformDepartmentIdsForSubmit(
                formData.departmentIds,
                isSuperadmin
              );

              const result = await finalizePolicyUploadAction({
                body: {
                  uploadId: "", // Server will find by fileId
                  fileId,
                  name: formData.name,
                  description: formData.description,
                  active: formData.active,
                  departmentIds: deptIds,
                },
              });

              if (result.success && result.policyId) {
                toast.success("Policy created successfully");
                router.push(`/management/policies/p/${result.policyId}`);
              } else {
                toast.error("Failed to create policy", {
                  description: result.message || "Unknown error",
                });
                setIsUploading(false);
              }
            } catch (error) {
              toast.error("Failed to finalize policy upload", {
                description:
                  error instanceof Error ? error.message : "Unknown error",
              });
              setIsUploading(false);
            }
          },
        });

        // Start the upload
        await upload.start();
      }
    } catch (error) {
      toast.error(
        isEditMode ? "Failed to update policy" : "Failed to create policy",
        {
          description:
            error instanceof Error ? error.message : "Unknown error",
        }
      );
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 py-4 px-4">
      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Policy Name *</Label>
          <Input
            id="name"
            value={formData["name"]}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Enter policy name"
            disabled={isSubmitting || isUploading}
            data-testid="input-policy-name"
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={formData["description"]}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter policy description"
            rows={4}
            disabled={isSubmitting || isUploading}
            data-testid="input-policy-description"
            className={errors.description ? "border-destructive" : ""}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Department Selection */}
        {validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <DepartmentPicker
              mapping={departmentMapping}
              validIds={validDepartmentIds}
              selectedIds={formData.departmentIds || []}
              onSelect={(ids) => handleInputChange("departmentIds", ids)}
              placeholder="All Departments"
              disabled={isSubmitting || isUploading}
              multiSelect={true}
              triggerProps={{ "data-testid": "picker-department" }}
            />
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
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) => handleInputChange("active", checked)}
                disabled={isSubmitting || isUploading}
                data-testid="switch-policy-active"
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive policies will not be available for videos
            </p>
          </div>
        </div>

        {/* File Upload (only for create mode) */}
        {!isEditMode && (
          <div className="space-y-2">
            <Label htmlFor="file">Policy File *</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                disabled={isSubmitting || isUploading}
                className="cursor-pointer"
                data-testid="input-policy-file"
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isSubmitting || isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Upload className="h-3 w-3 mr-1" />
                  {selectedFile.name}
                </Badge>
                {isUploading && (
                  <Badge variant="secondary">
                    Uploading... {uploadProgress}%
                  </Badge>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              File will be uploaded when you click Save
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isUploading}
            data-testid="btn-save-policy"
          >
            {isSubmitting || isUploading
              ? isEditMode
                ? "Saving..."
                : "Creating..."
              : isEditMode
                ? "Save Changes"
                : "Create Policy"}
          </Button>
        </div>
      </form>
    </div>
  );
}

