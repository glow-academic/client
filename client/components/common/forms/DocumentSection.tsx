/**
 * DocumentSection.tsx
 * Reusable document selection section component
 */
"use client";
import {
  ArrowRight,
  Check,
  Eye,
  Loader2,
  RotateCcw,
  Search,
  Shuffle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "active" | "completed";

export interface DocumentSectionProps {
  // Data
  validDocumentIds: string[];
  documentMapping: Record<string, DocumentMappingItem>;
  selectedDocumentIds: string[];
  templateDocumentIds: string[];
  documentDetails?: Array<{
    document_id: string;
    name: string;
    updatedAt: string;
    extension: string;
    scenario_ids: string[];
    can_edit: boolean;
    can_delete: boolean;
    active: boolean;
    department_ids: string[] | null;
    upload_id: string | null;
    field_ids: string[];
  }>;

  // State
  searchTerm: string;
  minMax: { min: number; max: number }; // Current values
  allowedRange?: { min: number; max: number }; // Allowed limits (optional, defaults to minMax if not provided)
  previewDocumentId: string | null;

  // Callbacks
  onDocumentIdsChange: (ids: string[]) => void;
  onTemplateDocumentIdsChange: (ids: string[]) => void;
  onSearchTermChange: (term: string) => void;
  onMinMaxChange: (minMax: { min: number; max: number }) => void;
  onPreviewDocument: (docId: string | null) => void;
  onRandomize: () => void;
  onReset: () => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
  isRandomizing?: boolean;
}

export function DocumentSection({
  validDocumentIds,
  documentMapping,
  selectedDocumentIds,
  templateDocumentIds: _templateDocumentIds,
  documentDetails,
  searchTerm,
  minMax,
  allowedRange,
  previewDocumentId,
  onDocumentIdsChange,
  onTemplateDocumentIdsChange: _onTemplateDocumentIdsChange,
  onSearchTermChange,
  onMinMaxChange,
  onPreviewDocument,
  onRandomize,
  onReset,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  disabled = false,
  isEditMode = false,
  isRandomizing = false,
}: DocumentSectionProps) {
  // Use allowedRange for slider limits, minMax for current values
  const sliderMin = allowedRange?.min ?? minMax.min ?? 0;
  const sliderMax = allowedRange?.max ?? minMax.max ?? 3;
  // Local state for preview dialog (managed internally)
  const [localPreviewDocumentId, setLocalPreviewDocumentId] = useState<
    string | null
  >(previewDocumentId);

  // Sync with prop when it changes externally
  useEffect(() => {
    setLocalPreviewDocumentId(previewDocumentId);
  }, [previewDocumentId]);

  // Filter documents based on search term
  const filteredDocumentIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validDocumentIds;
    }
    const searchLower = searchTerm.toLowerCase();
    return validDocumentIds.filter((docId) => {
      const doc = documentMapping[docId];
      if (!doc) return false;
      const searchText = `${doc.name} ${doc.description || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validDocumentIds, documentMapping, searchTerm]);

  const handlePreviewClick = (docId: string) => {
    setLocalPreviewDocumentId(docId);
    onPreviewDocument(docId);
  };

  const handlePreviewClose = (open: boolean) => {
    if (!open) {
      setLocalPreviewDocumentId(null);
      onPreviewDocument(null);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "transition-all",
          !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
          !isEditMode && stepStatus === "pending" && "opacity-50"
        )}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                stepStatus === "completed"
                  ? "bg-green-500 text-white"
                  : stepStatus === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              )}
            >
              {stepStatus === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                String(stepNumber)
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{stepTitle}</CardTitle>
              </div>
              <CardDescription>{stepDescription}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isReadonly || disabled || isRandomizing}
                    >
                      {isRandomizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Shuffle className="h-4 w-4" />
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Randomize</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <RangeSlider
                    min={sliderMin}
                    max={sliderMax}
                    value={[minMax.min ?? sliderMin, minMax.max ?? sliderMax]}
                    onValueChange={([min, max]) =>
                      onMinMaxChange({
                        min: min ?? sliderMin,
                        max: max ?? sliderMax,
                      })
                    }
                    disabled={isReadonly || disabled}
                    label="Range"
                  />
                  <Button
                    onClick={onRandomize}
                    disabled={isReadonly || disabled || isRandomizing}
                    className="w-full"
                    size="sm"
                  >
                    {isRandomizing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Randomizing...
                      </>
                    ) : (
                      <>
                        Randomize
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isReadonly || disabled}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-6">
          {/* Search bar */}
          <div className="flex h-9 items-center gap-2 border-b px-0">
            <Search className="size-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isReadonly || disabled}
            />
          </div>

          {/* Filtered documents grid */}
          <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
            {filteredDocumentIds.map((docId) => {
              const document = documentMapping[docId];
              if (!document) return null;

              const isSelected = selectedDocumentIds.includes(docId);
              const fullDoc = documentDetails?.find(
                (d) => d.document_id === docId
              );

              // Create document item for DocumentViewer
              const docForViewer: DocumentItem = fullDoc
                ? {
                    document_id: fullDoc.document_id,
                    name: fullDoc.name,
                    updatedAt: fullDoc.updatedAt,
                    extension: fullDoc.extension,
                    scenario_ids: fullDoc.scenario_ids,
                    can_edit: fullDoc.can_edit,
                    can_delete: fullDoc.can_delete,
                    active: fullDoc.active,
                    department_ids: fullDoc.department_ids,
                    upload_id: fullDoc.upload_id ?? null,
                    field_ids: fullDoc.field_ids || [],
                  }
                : {
                    document_id: docId,
                    name: document.name || "Document",
                    updatedAt: new Date().toISOString(),
                    extension: "",
                    scenario_ids: [],
                    can_edit: false,
                    can_delete: false,
                    active: true,
                    department_ids: [],
                    upload_id: null,
                    field_ids: [],
                  };

              return (
                <button
                  key={docId}
                  type="button"
                  onClick={() => {
                    if (isReadonly || disabled) return;
                    const newIds = isSelected
                      ? selectedDocumentIds.filter((id) => id !== docId)
                      : [...selectedDocumentIds, docId]; // Allow selecting more than max - max is for randomization, not a hard limit
                    onDocumentIdsChange(newIds);
                  }}
                  disabled={isReadonly || disabled}
                  className={cn(
                    "relative aspect-square rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden",
                    "hover:shadow-md",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary"
                  )}
                >
                  {/* Preview button - top left */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewClick(docId);
                    }}
                    className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePreviewClick(docId);
                      }
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>

                  {/* Check icon - top right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  {/* Document preview */}
                  <div className="w-full h-full">
                    <DocumentViewer
                      document={docForViewer}
                      bare={true}
                      isFormDocument={false}
                      compact={true}
                    />
                  </div>

                  {/* Document name at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                    <span className="truncate block">{document.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>

        {/* Preview Dialog */}
        <Dialog
          open={localPreviewDocumentId !== null}
          onOpenChange={handlePreviewClose}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {localPreviewDocumentId
                  ? documentMapping[localPreviewDocumentId]?.name
                  : "Document Preview"}
              </DialogTitle>
              <DialogDescription>Preview document content</DialogDescription>
            </DialogHeader>
            {localPreviewDocumentId &&
              (() => {
                const docId = localPreviewDocumentId;
                const fullDoc = documentDetails?.find(
                  (d) => d.document_id === docId
                );
                const docForViewer: DocumentItem = fullDoc
                  ? {
                      document_id: fullDoc.document_id,
                      name: fullDoc.name,
                      updatedAt: fullDoc.updatedAt,
                      extension: fullDoc.extension,
                      scenario_ids: fullDoc.scenario_ids,
                      can_edit: fullDoc.can_edit,
                      can_delete: fullDoc.can_delete,
                      active: fullDoc.active,
                      department_ids: fullDoc.department_ids,
                      upload_id: fullDoc.upload_id ?? null,
                      field_ids: fullDoc.field_ids || [],
                    }
                  : {
                      document_id: docId,
                      name: documentMapping[docId]?.name || "Document",
                      updatedAt: new Date().toISOString(),
                      extension: "",
                      scenario_ids: [],
                      can_edit: false,
                      can_delete: false,
                      active: true,
                      department_ids: [],
                      upload_id: null,
                      field_ids: [],
                    };
                return (
                  <div className="mt-4">
                    <DocumentViewer
                      document={docForViewer}
                      bare={true}
                      isFormDocument={false}
                    />
                  </div>
                );
              })()}
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );
}
