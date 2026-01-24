/**
 * Documents.tsx
 * Resource component for document selection
 * Uses SelectableGrid to select existing document artifacts
 * Manages document_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<"/api/v4/resources/documents", "post">;

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
}

export interface DocumentsProps {
  document_ids?: string[]; // Current document artifact IDs (standardized prop name)
  document_resources?: Array<{
    document_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected document resources (each includes generated field)
  show_documents?: boolean; // Whether to show this resource picker
  document_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  documents?: Array<{
    document_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available documents from API (each includes generated field)
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
}: DocumentsProps) {
  const ids = useMemo(() => document_ids ?? [], [document_ids]);
  const show = show_documents ?? false;
  const allDocuments = useMemo(() => documents ?? [], [documents]);
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
    return allDocuments
      .filter((d) => d.document_id && d.name) // Filter out nulls
      .map((d) => ({
        id: d.document_id!,
        name: d.name!,
        ...(d.description ? { description: d.description } : {}), // Only include if not null/undefined
      }));
  }, [allDocuments]);

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

      // Create resource if newly selected
      if (
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
    [ids, onChange, createDocumentsAction, documents_agent_id, group_id]
  );

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
        renderItem={(item, isSelected) => {
          const suggested = isSuggested(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent"
              )}
            >
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

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No documents found."
        disabled={disabled}
      />
    </div>
  );
}
