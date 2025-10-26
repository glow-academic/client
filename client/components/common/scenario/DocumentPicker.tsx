/**
 * DocumentPicker.tsx
 * Used to pick documents as part of the scenario creation
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Eye, X } from "lucide-react";
import * as React from "react";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import type { MappingItem } from "@/lib/api/v2/schemas/base";
import type { DocumentItem } from "@/lib/api/v2/schemas/documents";
import { cn } from "@/lib/utils";

// Extended mapping item for documents with tags
export interface DocumentMappingItem extends MappingItem {
  tags?: string[];
  type?: string;
  filePath?: string;
  mimeType?: string;
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
  ...props
}: DocumentPickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [previewDocumentId, setPreviewDocumentId] = React.useState<
    string | undefined
  >(undefined);

  // Build documents from mapping (before filtering)
  const allDocuments = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Filter documents (no tag filtering, just validIds)
  const documents = allDocuments;

  const [peekedDocument, setPeekedDocument] = React.useState<
    ({ id: string } & T) | undefined
  >(documents[0] as ({ id: string } & T) | undefined);

  const handleSelect = (documentId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(documentId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== documentId)
        : [...selectedIds, documentId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([documentId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Handle document preview
  const handlePreview = (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewDocumentId(documentId);
    setShowPreviewDialog(true);
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== documentId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const doc = mapping[selectedIds[0]!];
      return doc?.name || placeholder;
    }
    return `${selectedIds.length} selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Get document type icon
  const getDocumentTypeIcon = (type?: string) => {
    const typeMap: Record<string, string> = {
      homework: "📚",
      exam: "📝",
      syllabus: "📋",
      rubric: "📊",
      other: "📄",
    };
    return typeMap[type || "other"] || "📄";
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
                    onClick={(e) => handlePreview(id, e)}
                    className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveItem(id, e)}
                    className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Document preview - note: DocumentViewer expects full document object */}
                <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
                  <div className="flex items-center justify-center h-full">
                    <span className="text-4xl">
                      {getDocumentTypeIcon(document.type)}
                    </span>
                  </div>

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

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a document"
            className="w-full justify-between"
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[400px] w-[350px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedDocument?.name || "No document selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedDocument?.type || "No type available"}
                </div>
                {peekedDocument && (
                  <div className="mt-4 text-center">
                    <div className="text-6xl mb-2">
                      {getDocumentTypeIcon(peekedDocument.type)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {peekedDocument.filePath || "No file path"}
                    </div>
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search documents..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear {multiSelect ? "All" : "Selection"}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Documents">
                  {documents.map((document) => (
                    <DocumentItem
                      key={document.id}
                      document={document as { id: string } & T}
                      isSelected={selectedIds.includes(document.id)}
                      onPeek={(doc) => setPeekedDocument(doc)}
                      onSelect={() => handleSelect(document.id)}
                      getDocumentTypeIcon={getDocumentTypeIcon}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>

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
                (d) => d.document_id === previewDocumentId
              );
              if (fullDoc) {
                return (
                  <div className="flex-1 min-h-0">
                    <DocumentViewer
                      document={fullDoc}
                      bare={true}
                      isFormDocument={false}
                    />
                  </div>
                );
              }
              // Fallback if full document not available
              const mappedDoc = mapping[previewDocumentId];
              return mappedDoc ? (
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-8xl mb-4">
                      {getDocumentTypeIcon(mappedDoc.type)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preview not available - document details missing
                    </p>
                  </div>
                </div>
              ) : null;
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

interface DocumentItemProps<T extends DocumentMappingItem> {
  document: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (document: { id: string } & T) => void;
  getDocumentTypeIcon: (type?: string) => string;
}

function DocumentItem<T extends DocumentMappingItem>({
  document,
  isSelected,
  onSelect,
  onPeek,
  getDocumentTypeIcon,
}: DocumentItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(document);
      }
    });
  });

  return (
    <CommandItem
      key={document.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center gap-2 w-full">
        <span className="text-lg">{getDocumentTypeIcon(document.type)}</span>
        <span className="flex-1 truncate">{document.name}</span>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
