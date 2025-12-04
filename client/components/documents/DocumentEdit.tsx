/**
 * DocumentEdit.tsx
 * Document edit form component - full page version of edit dialog
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import type {
  DocumentDetailOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
} from "@/app/(main)/management/documents/d/[documentId]/page";
import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import ParameterItemPicker from "@/components/common/forms/ParameterItemPicker";
import TemplatePreview from "@/components/documents/TemplatePreview";
import TemplateForm, { type TemplateSchema } from "@/components/documents/TemplateForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/profile-context";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface DocumentEditProps {
  documentId: string;
  documentDetail: DocumentDetailOut;
  updateDocumentAction: (input: UpdateDocumentIn) => Promise<UpdateDocumentOut>;
  renderedHtml?: string | null;
}

export default function DocumentEdit({
  documentId,
  documentDetail,
  updateDocumentAction,
  renderedHtml = null,
}: DocumentEditProps) {
  const router = useRouter();
  const { effectiveDepartmentIds, effectiveProfile } = useProfile();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    active: boolean;
    departmentIds: string[];
    parameterItemIds: string[];
    classifyAgentId: string | null;
    documentAgentId: string | null;
  }>({
    name: "",
    active: true,
    departmentIds: [],
    parameterItemIds: [],
    classifyAgentId: null,
    documentAgentId: null,
  });

  // Template state
  const [templateArgs, setTemplateArgs] = useState<Record<string, any>>({});

  // Extract mappings from detail response
  const departmentMapping = useMemo(
    () => documentDetail?.department_mapping || {},
    [documentDetail]
  );
  const parameterItemMapping = useMemo(
    () => documentDetail?.parameter_item_mapping || {},
    [documentDetail]
  );
  const agentMapping = useMemo(
    () => documentDetail?.agent_mapping || {},
    [documentDetail]
  );

  // Compute valid parameter item IDs based on selected departments
  const validParameterItemIds = useMemo(() => {
    const baseIds = documentDetail?.valid_parameter_item_ids || [];
    const selectedDeptIds = formData.departmentIds;

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of parameter_ids from selected departments
    const deptParameterIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.parameter_ids && Array.isArray(deptData.parameter_ids)) {
        deptData.parameter_ids.forEach((id) => deptParameterIds.add(id));
      }
    });

    // Filter parameter items: include if their parameter_id is in department parameter IDs
    return baseIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      return item && deptParameterIds.has(item.parameter_id);
    });
  }, [formData.departmentIds, departmentMapping, parameterItemMapping, documentDetail]);

  // Initialize form data from document detail
  useEffect(() => {
    if (documentDetail) {
      setFormData({
        name: documentDetail.name || "",
        active: documentDetail.active ?? true,
        departmentIds: documentDetail.department_ids || [],
        parameterItemIds: documentDetail.parameter_item_ids || [],
        classifyAgentId: documentDetail.classify_agent_id || null,
        documentAgentId: documentDetail.document_agent_id || null,
      });

      // Initialize template args if template document
      if (documentDetail.template && documentDetail.template_args) {
        setTemplateArgs(documentDetail.template_args);
      }
    }
  }, [documentDetail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUpdating(true);
    try {
      await updateDocumentAction({
        body: {
          documentId,
          name: formData.name,
          active: formData.active,
          department_id: formData.departmentIds.length > 0 ? formData.departmentIds[0] : null,
          parameter_item_ids: formData.parameterItemIds,
          classify_agent_id: formData.classifyAgentId || undefined,
          document_agent_id: formData.documentAgentId || undefined,
          template: documentDetail.template || undefined,
          templateArgs: documentDetail.template ? templateArgs : undefined,
        },
      });

      toast.success("Document updated successfully");
      router.push("/management/documents");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update document"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const validDepartmentIds = useMemo(() => {
    return documentDetail?.valid_department_ids || effectiveDepartmentIds;
  }, [documentDetail, effectiveDepartmentIds]);

  const isTemplate = documentDetail?.template === true;
  const templateSchema = documentDetail?.template_schema as TemplateSchema | null;
  const templateHtml = documentDetail?.template_html || null;

  return (
    <div className="space-y-6">
      {/* Template Preview Section */}
      {isTemplate && templateSchema && templateHtml && (
        <Card>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Template Preview */}
              <div className="space-y-2">
                <Label>Rendered Output</Label>
                <div className="border rounded-md min-h-[400px]">
                  <TemplatePreview
                    documentId={documentId}
                    templateHtml={templateHtml}
                    renderedHtml={renderedHtml}
                  />
                </div>
              </div>

              {/* Template Form */}
              <div className="space-y-2">
                <Label>Template Arguments</Label>
                <div className="border rounded-md p-4 max-h-[400px] overflow-auto">
                  <TemplateForm
                    schema={templateSchema}
                    values={templateArgs}
                    onChange={setTemplateArgs}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Document name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Document name"
              required
            />
          </div>

          {/* Active status */}
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
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Department Selection */}
          {validDepartmentIds && validDepartmentIds.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={formData.departmentIds}
                onSelect={(ids) =>
                  setFormData((prev) => ({ ...prev, departmentIds: ids }))
                }
                multiSelect={true}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Parameter Items</Label>
            <ParameterItemPicker
              mapping={parameterItemMapping}
              selectedIds={formData.parameterItemIds}
              onSelect={(ids) =>
                setFormData((prev) => ({
                  ...prev,
                  parameterItemIds: ids as string[],
                }))
              }
              validIds={validParameterItemIds}
              parameterId=""
              parameterName="Parameter Items"
              allowCreate={false}
              multiSelect={true}
              badgesPosition="below"
              showClearAll={true}
            />
          </div>

          {/* Agent Selection */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Classify Agent */}
            <div className="space-y-2">
              <Label htmlFor="classifyAgentId">Classify Agent</Label>
              {formData?.classifyAgentId !== undefined ? (
                <AgentPicker
                  mapping={agentMapping}
                  validIds={
                    documentDetail?.valid_agent_ids?.filter((id) => {
                      const agent = agentMapping[id];
                      return agent?.roles?.includes("classify");
                    }) || []
                  }
                  selectedIds={
                    formData?.classifyAgentId ? [formData.classifyAgentId] : []
                  }
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      classifyAgentId: ids[0] || null,
                    }))
                  }
                  placeholder="Select classify agent"
                  disabled={isUpdating}
                  multiSelect={false}
                />
              ) : null}
            </div>

            {/* Document Agent */}
            <div className="space-y-2">
              <Label htmlFor="documentAgentId">Document Agent</Label>
              {formData?.documentAgentId !== undefined ? (
                <AgentPicker
                  mapping={agentMapping}
                  validIds={
                    documentDetail?.valid_agent_ids?.filter((id) => {
                      const agent = agentMapping[id];
                      return agent?.roles?.includes("document");
                    }) || []
                  }
                  selectedIds={
                    formData?.documentAgentId ? [formData.documentAgentId] : []
                  }
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      documentAgentId: ids[0] || null,
                    }))
                  }
                  placeholder="Select document agent"
                  disabled={isUpdating}
                  multiSelect={false}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/management/documents")}
            disabled={isUpdating}
          >
            Back
          </Button>
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update"}
          </Button>
        </div>
      </form>
    </div>
  );
}

