/**
 * Documents.tsx
 * Resource component for document selection
 * Uses SelectableGrid to select existing document artifacts
 * Manages document_ids array and reports to parent
 */

"use client";

import DocumentViewer, {
  type DocumentItem as DocumentViewerItem,
} from "@/components/common/chat/viewers/DocumentViewer";
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Eye, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<"/api/v4/resources/documents", "post">;

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  upload_id?: string;
}

export interface DocumentsProps {
  document_ids?: string[]; // Current document artifact IDs (standardized prop name)
  document_resources?: Array<{
    document_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected document resources (each includes generated field)
  show_documents?: boolean; // Whether to show this resource picker
  document_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  documents?: Array<{
    document_id?: string | null;
    name?: string | null;
    description?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
    upload_id?: string | null;
    parameter_ids?: string[] | null;
    field_ids?: string[] | null;
    parent_document_id?: string | null;
    video_document?: boolean | null;
    non_video_document?: boolean | null;
  }>; // All available documents from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update document_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  documents_agent_id?: string | null; // Agent ID for resource creation
  createDocumentsAction?:
    | ((input: CreateDraftDocumentsIn) => Promise<CreateDraftDocumentsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  videoEnabled?: boolean; // Whether video mode is enabled (for filtering)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ document_ids: string[] } | void>) => void;
  // AI diff view props
  aiDocumentResources?: Array<{
    document_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Documents({
  document_ids,
  document_resources,
  show_documents = false,
  document_suggestions,
  documents,
  disabled = false,
  onChange,
  label = "Documents",
  id = "documents",
  required = false,
  placeholder: _placeholder = "Select documents...",
  description,
  group_id,
  documents_agent_id,
  createDocumentsAction,
  onGenerate,
  isGenerating = false,
  videoEnabled = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiDocumentResources,
  onAccept,
  onReject,
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
  const suggestionsList = useMemo(
    () => document_suggestions ?? [],
    [document_suggestions]
  );

  // Track which document IDs have already had resources created
  const createdDocumentIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdDocumentIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdDocumentIdsRef.current.add(id));
  }, [ids]);

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

  // Ref for flush function
  const flushRef = useRef<(() => Promise<{ document_ids: string[] } | void>) | undefined>(undefined);

  // State for preview dialog
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);

  // Check if a document is suggested
  const isSuggested = useCallback(
    (documentId: string) => suggestionsList.includes(documentId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (documentId: string) => {
      // Toggle selection
      const isCurrentlySelected = ids.includes(documentId);
      const newIds = isCurrentlySelected
        ? ids.filter((id) => id !== documentId)
        : [...ids, documentId];

      // Create resource if newly selected (only if autosave is enabled)
      if (
        isAutosaveEnabled &&
        !isCurrentlySelected &&
        !createdDocumentIdsRef.current.has(documentId) &&
        createDocumentsAction &&
        documents_agent_id &&
        group_id
      ) {
        try {
          await createDocumentsAction({
            body: {
              agent_id: documents_agent_id,
              group_id: group_id,
              document_id: documentId,
              mcp: false,
            },
          });
          createdDocumentIdsRef.current.add(documentId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(
            `Failed to create document resource for ${documentId}:`,
            error
          );
        }
      }

      // Update parent state
      onChange(newIds);
    },
    [ids, onChange, createDocumentsAction, documents_agent_id, group_id, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ document_ids: string[] } | void> => {
    if (!createDocumentsAction || !documents_agent_id || !group_id) {
      return { document_ids: ids };
    }

    // Create resources for any selected documents that haven't been created yet
    for (const documentId of ids) {
      if (!createdDocumentIdsRef.current.has(documentId)) {
        try {
          await createDocumentsAction({
            body: {
              agent_id: documents_agent_id,
              group_id: group_id,
              document_id: documentId,
              mcp: false,
            },
          });
          createdDocumentIdsRef.current.add(documentId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create document resource for ${documentId}:`, error);
        }
      }
    }

    return { document_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Check if any document resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return document_resources?.some((d) => d.generated) ?? false;
  }, [document_resources]);

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
          {onGenerate && documents_agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
            upload_id: fullDoc?.upload_id ?? null,
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
                isSelected && "ring-2 ring-primary"
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
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Suggested badge - top right */}
              {suggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
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
          {previewDocumentId && (() => {
            const docId = previewDocumentId;
            const fullDoc = filteredDocuments.find(
              (d) => d.document_id === docId
            );
            const docForViewer: DocumentViewerItem = {
              document_id: docId,
              name: documentItems.find((d) => d.id === docId)?.name || "Document",
              updated_at: new Date().toISOString(),
              extension: fullDoc?.file_path?.split(".").pop() || "",
              scenario_ids: [],
              can_edit: false,
              can_delete: false,
              active: true,
              department_ids: [],
              upload_id: fullDoc?.upload_id ?? null,
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
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
