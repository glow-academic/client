/**
 * DocumentPicker.tsx
 * Used to pick documents as part of the scenario creation
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Eye, Filter, X } from "lucide-react";
import * as React from "react";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";
import { Document } from "@/types";

export interface DocumentPickerProps extends PopoverProps {
  documents: Document[];
  label?: string;
  placeholder?: string;
  description?: string;
  onSelect?: (document: Document) => void;
  selectedDocument?: Document | undefined;
  selectedDocuments?: Document[]; // For multiple selection
  multiSelect?: boolean; // Enable multiple selection mode
  onMultiSelect?: (documents: Document[]) => void; // Callback for multiple selection
  hideSelectedChips?: boolean; // Hide the built-in selected chips display
  disabled?: boolean; // Disable the picker
}

export function DocumentPicker({
  documents,
  label = "Document",
  placeholder = "Select a document...",
  description = "Choose documents that will be available during this scenario.",
  onSelect,
  selectedDocument: externalSelectedDocument,
  selectedDocuments: externalSelectedDocuments = [],
  multiSelect = false,
  onMultiSelect,
  hideSelectedChips = false,
  disabled = false,
  ...props
}: DocumentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedDocument, setInternalSelectedDocument] =
    React.useState<Document | undefined>(undefined);
  const [internalSelectedDocuments, setInternalSelectedDocuments] =
    React.useState<Document[]>([]);
  const [peekedDocument, setPeekedDocument] = React.useState<
    Document | undefined
  >(documents[0]);
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [previewDocument, setPreviewDocument] = React.useState<
    Document | undefined
  >(undefined);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterTags, setFilterTags] = React.useState<string[]>([]);

  // Unique known tags from provided documents
  const knownTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach((doc) => {
      const tags = (doc as unknown as { tags?: string[] }).tags || [];
      tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [documents]);

  // Use external selectedDocument if provided, otherwise use internal state
  const selectedDocument = externalSelectedDocument || internalSelectedDocument;
  const selectedDocuments = multiSelect
    ? externalSelectedDocuments
    : internalSelectedDocuments;

  const handleSelect = (document: Document) => {
    if (multiSelect) {
      const isSelected = selectedDocuments.some((d) => d.id === document.id);
      let newSelectedDocuments: Document[];

      if (isSelected) {
        // Remove from selection
        newSelectedDocuments = selectedDocuments.filter(
          (d) => d.id !== document.id
        );
      } else {
        // Add to selection
        newSelectedDocuments = [...selectedDocuments, document];
      }

      if (!externalSelectedDocuments.length) {
        setInternalSelectedDocuments(newSelectedDocuments);
      }
      onMultiSelect?.(newSelectedDocuments);
      // Don't close popover in multi-select mode
    } else {
      if (!externalSelectedDocument) {
        setInternalSelectedDocument(document);
      }
      onSelect?.(document);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    if (multiSelect) {
      if (!externalSelectedDocuments.length) {
        setInternalSelectedDocuments([]);
      }
      onMultiSelect?.([]);
    } else {
      if (!externalSelectedDocument) {
        setInternalSelectedDocument(undefined);
      }
      // Call onSelect with a special "clear" document to indicate clearing
      onSelect?.({
        id: "",
        name: "",
        type: "homework",
        active: true,
        createdAt: "",
        updatedAt: "",
        filePath: "",
        mimeType: "",
        classified: false,
        fileId: null,
        tags: [],
      });
    }
    setOpen(false);
  };

  // Handle document preview
  const handlePreview = (document: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (
    documentToRemove: Document,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (multiSelect) {
      const newSelectedDocuments = selectedDocuments.filter(
        (d) => d.id !== documentToRemove.id
      );
      if (!externalSelectedDocuments.length) {
        setInternalSelectedDocuments(newSelectedDocuments);
      }
      onMultiSelect?.(newSelectedDocuments);
    }
  };

  const getButtonText = () => {
    if (multiSelect) {
      if (selectedDocuments.length === 0) {
        return placeholder;
      }
      if (selectedDocuments.length === 1) {
        return selectedDocuments[0]!.name;
      }
      return `${selectedDocuments.length} selected`;
    }
    return selectedDocument ? selectedDocument.name : placeholder;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found. Try searching by name or tag`;
  };

  // Get document type icon
  const getDocumentTypeIcon = (type: string) => {
    const typeMap: Record<string, string> = {
      homework: "📚",
      exam: "📝",
      syllabus: "📋",
      rubric: "📊",
      other: "📄",
    };
    return typeMap[type] || "📄";
  };

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
      {multiSelect && selectedDocuments.length > 0 && !hideSelectedChips && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {selectedDocuments.map((document) => (
            <div
              key={document.id}
              className="relative group border rounded-lg hover:shadow-md transition-all bg-white"
            >
              {/* Action buttons */}
              <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => handlePreview(document, e)}
                  className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(document, e)}
                  className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Document preview */}
              <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
                <DocumentViewer
                  document={document}
                  bare={true}
                  isFormDocument={false}
                />

                {/* Document name */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                  <span className="truncate block">{document.name}</span>
                </div>
              </div>
            </div>
          ))}
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
                  <div className="mt-4">
                    <div className="border rounded-md h-64 overflow-hidden">
                      <DocumentViewer
                        document={peekedDocument}
                        bare={true}
                        isFormDocument={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput
                  placeholder="Search documents..."
                  endAdornment={
                    <Popover
                      open={filterPopoverOpen}
                      onOpenChange={setFilterPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Filter by tags"
                          title="Filter by tags"
                          className={cn(
                            "relative hover:bg-accent overflow-visible h-8 w-8 p-0",
                            filterTags.length > 0
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterPopoverOpen((prev) => !prev);
                          }}
                        >
                          <Filter className="h-4 w-4" />
                          {filterTags.length > 0 && !filterPopoverOpen && (
                            <span
                              className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background z-10"
                              aria-label="Active tag filters"
                            />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        title="Filter by tags"
                        className="w-72"
                        align="end"
                        side="top"
                        sideOffset={8}
                      >
                        <div className="space-y-3">
                          <div className="text-sm font-medium">
                            Filter by tags
                          </div>
                          <ScrollArea className="max-h-56 pr-2">
                            <div className="space-y-2">
                              {knownTags.length === 0 && (
                                <div className="text-sm text-muted-foreground">
                                  No tags available
                                </div>
                              )}
                              {knownTags.map((tag) => {
                                const checked = filterTags.includes(tag);
                                return (
                                  <label
                                    key={tag}
                                    className="flex items-center gap-2 text-sm cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(isChecked) => {
                                        setFilterTags((prev) => {
                                          if (isChecked) {
                                            if (prev.includes(tag)) return prev;
                                            return [...prev, tag];
                                          }
                                          return prev.filter((t) => t !== tag);
                                        });
                                      }}
                                    />
                                    <span className="truncate">{tag}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </ScrollArea>
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-muted-foreground">
                              {filterTags.length} selected
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setFilterTags([])}
                              >
                                Clear
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setFilterPopoverOpen(false)}
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  }
                />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {((multiSelect && selectedDocuments.length > 0) ||
                  (!multiSelect && selectedDocument)) && (
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
                  {documents
                    .filter((document) => document.active)
                    .filter((document) => {
                      if (filterTags.length === 0) return true;
                      const tags =
                        (document as unknown as { tags?: string[] }).tags || [];
                      return filterTags.every((t) => tags.includes(t));
                    })
                    .map((document) => (
                      <DocumentItem
                        key={document.id}
                        document={document}
                        isSelected={
                          multiSelect
                            ? selectedDocuments.some(
                                (d) => d.id === document.id
                              )
                            : selectedDocument?.id === document.id
                        }
                        onPeek={(document) => setPeekedDocument(document)}
                        onSelect={() => handleSelect(document)}
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
              Preview the document content below.
            </DialogDescription>
          </DialogHeader>
          {previewDocument && (
            <div className="flex-1 min-h-0">
              <DocumentViewer
                document={previewDocument}
                bare={true}
                isFormDocument={false}
              />
            </div>
          )}
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

interface DocumentItemProps {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (document: Document) => void;
  getDocumentTypeIcon: (type: string) => string;
}

function DocumentItem({
  document,
  isSelected,
  onSelect,
  onPeek,
  getDocumentTypeIcon,
}: DocumentItemProps) {
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
        {/* Hidden tags text to improve search by tags */}
        {Array.isArray((document as unknown as { tags?: string[] }).tags) && (
          <span className="sr-only">
            {(document as unknown as { tags?: string[] }).tags?.join(" ")}
          </span>
        )}
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
