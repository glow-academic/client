/**
 * AttemptDocumentArea.tsx
 * Document sidebar component
 * Explicit, self-contained types (like resource components)
 */
"use client";

import DocumentViewer from "@/components/artifacts/attempt/chat/viewers/DocumentViewer";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import { FileText } from "lucide-react";

// Explicit, self-contained prop interface (like resource components)
export interface DocumentAreaProps {
  visible: boolean;

  // Explicit document type - self-contained
  // These are already the documents for the current chat (pre-filtered by server)
  documents: Array<{
    document_id: string | null;
    name: string | null;
    updated_at: string | null;
    extension: string | null;
    scenario_ids: Array<string> | null;
    can_edit: boolean | null;
    can_delete: boolean | null;
    active: boolean | null;
    department_ids: Array<string> | null;
    upload_id: string | null;
    html: boolean | null;
    field_ids: Array<string> | null;
  }>;

  selected_document_id: string | null;
  on_select_document: (id: string | null) => void;

  document_viewer?: React.ComponentType<any>;
  disabled?: boolean;

  // Whether we're in graded/rubric view mode (affects height calculation)
  is_graded_view?: boolean;
}

// Unified item type for the selector
type SidebarItem = { type: "document"; id: string; name: string; data: DocumentAreaProps["documents"][number] };

export function AttemptDocumentArea({
  visible,
  documents,
  selected_document_id,
  on_select_document,
  document_viewer: DocumentViewerComponent = DocumentViewer,
  disabled = false,
  is_graded_view = false,
}: DocumentAreaProps) {
  if (!visible) return null;

  // Documents are already filtered for the current chat by the server
  const filteredDocs = documents.filter((doc) => doc.document_id);

  // Create unified list with type prefixes
  const items: SidebarItem[] = [
    ...filteredDocs.map((doc) => ({
      type: "document" as const,
      id: `doc:${doc.document_id}`,
      name: doc.name || "Document",
      data: doc,
    })),
  ];

  if (items.length === 0) return null;

  // Find selected item (support both prefixed and non-prefixed IDs for backwards compatibility)
  const selectedItem = items.find((item) => {
    if (!selected_document_id) return false;
    // Check prefixed ID
    if (item.id === selected_document_id) return true;
    // Check non-prefixed ID for backwards compatibility
    if (item.type === "document" && item.data.document_id === selected_document_id) return true;
    return false;
  }) || items[0];

  return (
    <>
      <ResizableHandle className="bg-transparent hidden md:block" />
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        maxSize={50}
        className="hidden md:block"
      >
        <Card className="h-full flex flex-col ml-2 p-0 border-0 border-l-0 shadow-none rounded-l-none">
          <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
            {/* Select dropdown directly above content */}
            {items.length > 1 && (
              <div className="p-2 pb-1.5">
                <Select
                  value={selectedItem?.id || ""}
                  onValueChange={(value) => on_select_document(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{item.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Content viewer */}
            <div className="flex-1 min-h-0 px-1 py-3">
              {selectedItem && selectedItem.type === "document" && (
                <DocumentViewerComponent
                  key={selectedItem.id}
                  document={{
                    document_id: selectedItem.data.document_id!,
                    name: selectedItem.data.name || "",
                    updated_at: selectedItem.data.updated_at || "",
                    extension: selectedItem.data.extension || "",
                    scenario_ids: selectedItem.data.scenario_ids || [],
                    can_edit: selectedItem.data.can_edit ?? false,
                    can_delete: selectedItem.data.can_delete ?? false,
                    active: selectedItem.data.active ?? false,
                    department_ids: selectedItem.data.department_ids,
                    upload_id: selectedItem.data.upload_id,
                    html: selectedItem.data.html,
                    field_ids: selectedItem.data.field_ids || [],
                    valid_field_ids: null,
                    active_scenario_count: null,
                    total_scenario_links: null,
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </ResizablePanel>
    </>
  );
}
