/**
 * DocumentPicker.tsx
 * Used to pick documents as part of the scenario creation
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, Eye, X } from "lucide-react";
import * as React from "react";

import DocumentViewer, {
  type DocumentItem as DocumentViewerItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { GenericPicker } from "./GenericPicker";

type MappingItem = {
  name: string;
  description: string;
};

// Use server type from documents list API
type DocumentsListOut = OutputOf<"/api/v4/artifacts/documents/list", "post">;
type DocumentItem = NonNullable<DocumentsListOut["documents"]>[number];

// Extended mapping item for documents with tags
export interface DocumentMappingItem extends MappingItem {
  tags?: string[];
  filePath?: string;
  mimeType?: string;
  parameter_ids?: string[] | null;
  field_ids?: string[] | null;
  parent_document_id?: string | null;
}

export interface DocumentPickerProps<
  T extends DocumentMappingItem = DocumentMappingItem,
> extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  documentDetails?: DocumentItem[]; // Full document objects for preview
  multiSelect?: boolean;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

export function DocumentPicker<
  T extends DocumentMappingItem = DocumentMappingItem,
>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  documentDetails = [],
  multiSelect = false,
  label = "Document",
  placeholder = "Select a document...",
  description = "Choose documents that will be available during this scenario.",
  hideSelectedChips = false,
  disabled = false,
  readonly = false,
  ...props
}: DocumentPickerProps<T>) {
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [previewDocumentId, setPreviewDocumentId] = React.useState<
    string | undefined
  >(undefined);

  // Handle document preview
  const handlePreview = (documentId: string) => {
    setPreviewDocumentId(documentId);
    setShowPreviewDialog(true);
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  const previewDocument = previewDocumentId
    ? mapping[previewDocumentId]
    : undefined;

  return (
    <div className="grid gap-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Label htmlFor="document">{label}</Label>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>

      {/* Show selected items in multi-select mode */}
      {multiSelect && selectedIds.length > 0 && !hideSelectedChips && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {selectedIds.map((id) => {
            const document = mapping[id];
            if (!document) return null;
            return (
              <div
                key={id}
                className="relative group border rounded-lg hover:shadow-md transition-all bg-white"
              >
                {/* Action buttons */}
                <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(id);
                    }}
                    className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(
                          selectedIds.filter((selectedId) => selectedId !== id),
                        );
                      }}
                      className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Document preview - show actual DocumentViewer if details available */}
                <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
                  {(() => {
                    const fullDoc = documentDetails.find(
                      (d) => d.document_id === id,
                    );
                    if (fullDoc) {
                      return (
                        <div className="w-full h-full">
                          <DocumentViewer
                            document={fullDoc as DocumentViewerItem}
                            bare={true}
                            isFormDocument={false}
                            compact={true}
                          />
                        </div>
                      );
                    }
                    // Fallback: create minimal DocumentItem from mapping so DocumentViewer can fetch it
                    if (id) {
                      const minimalDoc: DocumentViewerItem = {
                        document_id: id,
                        name: document.name || "Document",
                        updated_at: new Date().toISOString(),
                        extension: "",
                        scenario_ids: [],
                        can_edit: false,
                        can_delete: false,
                        active: true,
                        department_ids: [],
                        field_ids: [],
                        upload_id: id || null,
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                      };
                      return (
                        <div className="w-full h-full">
                          <DocumentViewer
                            document={minimalDoc}
                            bare={true}
                            isFormDocument={false}
                            compact={true}
                          />
                        </div>
                      );
                    }
                    // Final fallback to icon if no ID
                    const getDocumentIcon = () => "📄";
                    return (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-4xl">{getDocumentIcon()}</span>
                      </div>
                    );
                  })()}

                  {/* Document name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                    <span className="truncate block">{document.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GenericPicker
        items={mapping}
        itemIds={validIds}
        selectedIds={selectedIds}
        onSelect={onSelect}
        getId={(item) => (item as unknown as { id: string }).id}
        getLabel={(item) => item.name || ""}
        getSearchText={(item) => `${item.name} ${item.description || ""}`}
        renderButton={(selectedItems) => {
          if (selectedItems.length === 0) {
            return placeholder;
          }
          if (selectedItems.length === 1) {
            return selectedItems[0]?.name || placeholder;
          }
          return `${selectedItems.length} selected`;
        }}
        renderPreview={(item) => {
          const getDocumentIcon = () => "📄";
          return (
            <div className="grid gap-2">
              <h4 className="font-medium leading-none">
                {item.name || "No document selected"}
              </h4>
              {item.filePath && (
                <div className="mt-4 text-center">
                  <div className="text-6xl mb-2">{getDocumentIcon()}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.filePath}
                  </div>
                </div>
              )}
            </div>
          );
        }}
        renderItem={(item, isSelected) => {
          const getDocumentIcon = () => "📄";
          return (
            <div className="flex items-center gap-2 w-full">
              <span className="text-lg">{getDocumentIcon()}</span>
              <span className="flex-1 truncate">{item.name}</span>
              <Check
                className={cn(
                  "ml-auto",
                  isSelected ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          );
        }}
        renderChip={(item, onRemove) => {
          const id = (item as unknown as { id: string }).id;
          const fullDoc = documentDetails.find((d) => d.document_id === id);
          const getDocumentIcon = () => "📄";

          return (
            <div
              key={id}
              className="relative group border rounded-lg hover:shadow-md transition-all bg-white"
            >
              {/* Action buttons */}
              <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewDocumentId(id);
                    setShowPreviewDialog(true);
                  }}
                  className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <Eye className="h-3 w-3" />
                </button>
                {!readonly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Document preview */}
              <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
                {fullDoc ? (
                  <div className="w-full h-full">
                    <DocumentViewer
                      document={fullDoc as DocumentViewerItem}
                      bare={true}
                      isFormDocument={false}
                      compact={true}
                    />
                  </div>
                ) : id ? (
                  (() => {
                    const minimalDoc: DocumentViewerItem = {
                      document_id: id,
                      name: item.name || "Document",
                      updated_at: new Date().toISOString(),
                      extension: "",
                      scenario_ids: [],
                      can_edit: false,
                      can_delete: false,
                      active: true,
                      department_ids: [],
                      upload_id: id || null,
                      field_ids: [],
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                    };
                    return (
                      <div className="w-full h-full">
                        <DocumentViewer
                          document={minimalDoc}
                          bare={true}
                          isFormDocument={false}
                          compact={true}
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-4xl">{getDocumentIcon()}</span>
                  </div>
                )}

                {/* Document name */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                  <span className="truncate block">{item.name}</span>
                </div>
              </div>
            </div>
          );
        }}
        placeholder={placeholder}
        disabled={disabled || readonly}
        multiSelect={multiSelect}
        hideSelectedChips={true}
        buttonClassName="w-full"
        groupHeading="Documents"
        emptyMessage={getSearchNotFoundMessage()}
        showLabel={!!label}
        label={label}
        description={description}
        {...props}
      />

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl h-full max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {previewDocument?.name || "Document Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewDocument?.description ||
                "Preview the document content below."}
            </DialogDescription>
          </DialogHeader>
          {previewDocumentId &&
            (() => {
              const fullDoc = documentDetails.find(
                (d) => d.document_id === previewDocumentId,
              );
              if (fullDoc) {
                return (
                  <div className="flex-1 min-h-0">
                    <DocumentViewer
                      document={fullDoc as DocumentViewerItem}
                      bare={true}
                      isFormDocument={false}
                    />
                  </div>
                );
              }
              // Fallback: try to use mapping with document_id to fetch document
              const mappedDoc = mapping[previewDocumentId];
              if (mappedDoc && previewDocumentId) {
                // Create minimal DocumentItem from mapping with document_id
                // DocumentViewer can fetch the document using document_id
                const minimalDoc: DocumentViewerItem = {
                  document_id: previewDocumentId,
                  name: mappedDoc.name || "Document",
                  updated_at: new Date().toISOString(),
                  extension: "",
                  scenario_ids: [],
                  can_edit: false,
                  can_delete: false,
                  active: true,
                  department_ids: [],
                  upload_id: previewDocumentId || null,
                  field_ids: [],
                  valid_field_ids: null,
                  active_scenario_count: null,
                  total_scenario_links: null,
                };
                return (
                  <div className="flex-1 min-h-0">
                    <DocumentViewer
                      document={minimalDoc}
                      bare={true}
                      isFormDocument={false}
                    />
                  </div>
                );
              }
              return null;
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
