/**
 * Documents.tsx
 * Resource component for document selection
 * Uses SelectableGrid to select existing document artifacts
 * Manages document_ids array and reports to parent
 */

"use client";

import DocumentViewer, {
  type DocumentItem as DocumentViewerItem,
} from "@/components/common/viewers/DocumentViewer";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Eye, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface DocumentResourceItem {
  document_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
  video_document?: boolean | null;
  non_video_document?: boolean | null;
  file_path?: string | null;
  file_id?: string | null;
  upload_id?: string | null;
  field_ids?: string[] | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  upload_id?: string;
}

export interface DocumentsProps {
  document_ids?: string[]; // Current document artifact IDs (standardized prop name)
  document_resources?: DocumentResourceItem[]; // Selected document resources (each includes generated field)
  show_documents?: boolean; // Whether to show this resource picker
  documents?: DocumentResourceItem[]; // All available documents from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update document_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  videoEnabled?: boolean; // Whether video mode is enabled (for filtering)
}

export function Documents({
  document_ids,
  document_resources: _document_resources,
  show_documents = false,
  documents,
  disabled = false,
  onChange,
  label = "Documents",
  id = "documents",
  required = false,
  placeholder: _placeholder = "Select documents...",
  description,
  videoEnabled = false,
}: DocumentsProps) {
  const ids = useMemo(() => document_ids ?? [], [document_ids]);
  const show = show_documents ?? false;
  const allDocuments = useMemo(() => documents ?? [], [documents]);

  // Filter documents based on video mode
  // Include if: video mode ON and has video_document, OR video mode OFF and has non_video_document
  // Always include if neither flag is set (backward compatibility)
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((d) => {
      const hasVideoFlag = d.video_document === true;
      const hasNonVideoFlag = d.non_video_document === true;
      // If neither flag is set, always show (backward compatibility)
      if (!hasVideoFlag && !hasNonVideoFlag) {
        return true;
      }
      // If video mode is on, show if video_document is true
      if (videoEnabled) {
        return hasVideoFlag;
      }
      // If video mode is off, show if non_video_document is true
      return hasNonVideoFlag;
    });
  }, [allDocuments, videoEnabled]);
  // Convert documents array to DocumentItem format for GenericPicker
  const documentItems = useMemo(() => {
    return filteredDocuments
      .filter((d) => d.document_id && d.name) // Filter out nulls
      .map((d) => ({
        id: d.document_id!,
        name: d.name!,
        ...(d.description ? { description: d.description } : {}), // Only include if not null/undefined
      }));
  }, [filteredDocuments]);

  // State for preview dialog
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );

  // Check if a document is suggested (derived from item suggested field)
  const isSuggested = useCallback(
    (documentId: string) => {
      const doc = allDocuments.find((d) => d.document_id === documentId);
      return doc?.suggested === true;
    },
    [allDocuments]
  );

  const handleSelect = useCallback(
    (documentId: string) => {
      // Toggle selection
      const isCurrentlySelected = ids.includes(documentId);
      const newIds = isCurrentlySelected
        ? ids.filter((id) => id !== documentId)
        : [...ids, documentId];

      onChange(newIds);
    },
    [ids, onChange]
  );

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => documentItems.filter((i) => {
      const full = filteredDocuments.find((d) => d.document_id === i.id);
      return full?.pending === true;
    }),
    [documentItems, filteredDocuments]
  );
  const pendingIds = useMemo(() => new Set(pendingItems.map((i) => i.id)), [pendingItems]);
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in the list, no-op for selection
  const handleAccept = useCallback(() => {
    // no-op: pending items already in selection
  }, []);

  // Reject pending — remove pending IDs from selection
  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

  // Don't render if show_documents is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}

      <SelectableGrid<DocumentItem>
        items={documentItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        horizontal={true}
        renderItem={(item, isSelected) => {
          const suggested = isSuggested(item.id);
          const isPending = showDiff && pendingIds.has(item.id);

          // Find the full document data for DocumentViewer
          const fullDoc = filteredDocuments.find(
            (d) => d.document_id === item.id
          );

          // Create document item for DocumentViewer
          const docForViewer: DocumentViewerItem = {
            document_id: item.id,
            name: item.name || "Document",
            updated_at: new Date().toISOString(),
            extension: fullDoc?.file_path?.split(".").pop() || "",
            scenario_ids: [],
            can_edit: false,
            can_delete: false,
            active: true,
            department_ids: [],
            file_id: fullDoc?.file_id ?? null,
            field_ids: fullDoc?.field_ids || [],
            valid_field_ids: null,
            active_scenario_count: null,
            total_scenario_links: null,
          };

          return (
            <div
              className={cn(
                "relative aspect-square rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden",
                "hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isPending && "ring-2 ring-success bg-success/10",
                isSelected && !isPending && "ring-2 ring-primary"
              )}
            >
              {/* Preview button - top left */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewDocumentId(item.id);
                }}
                className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewDocumentId(item.id);
                  }
                }}
              >
                <Eye className="h-3.5 w-3.5 text-primary-foreground" />
              </div>

              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* Suggested dot indicator - top right */}
              {suggested && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Document preview */}
              <div className="w-full h-full">
                <DocumentViewer
                  document={docForViewer}
                  bare={true}
                  isFormDocument={false}
                  compact={true}
                  downloadBaseUrl="/api/documents/download"
                />
              </div>

              {/* Document name at bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                <span className="truncate block">{item.name}</span>
              </div>
            </div>
          );
        }}
        emptyMessage="No documents found."
        disabled={disabled}
      />

      {/* Preview Dialog */}
      <Dialog
        open={previewDocumentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDocumentId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {previewDocumentId
                ? documentItems.find((d) => d.id === previewDocumentId)?.name
                : "Document Preview"}
            </DialogTitle>
            <DialogDescription>Preview document content</DialogDescription>
          </DialogHeader>
          {previewDocumentId &&
            (() => {
              const docId = previewDocumentId;
              const fullDoc = filteredDocuments.find(
                (d) => d.document_id === docId
              );
              const docForViewer: DocumentViewerItem = {
                document_id: docId,
                name:
                  documentItems.find((d) => d.id === docId)?.name ||
                  "Document",
                updated_at: new Date().toISOString(),
                extension: fullDoc?.file_path?.split(".").pop() || "",
                scenario_ids: [],
                can_edit: false,
                can_delete: false,
                active: true,
                department_ids: [],
                file_id: fullDoc?.file_id ?? null,
                field_ids: fullDoc?.field_ids || [],
                valid_field_ids: null,
                active_scenario_count: null,
                total_scenario_links: null,
              };
              return (
                <div className="mt-4">
                  <DocumentViewer
                    document={docForViewer}
                    bare={true}
                    isFormDocument={false}
                    downloadBaseUrl="/api/documents/download"
                  />
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
