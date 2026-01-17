/**
 * AttemptDocumentArea.tsx
 * Document sidebar component
 * Explicit, self-contained types (like resource components)
 */
"use client";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { Card, CardContent } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";

// Explicit, self-contained prop interface (like resource components)
export interface DocumentAreaProps {
  visible: boolean;

  // Explicit document type - self-contained
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
    field_ids: Array<string> | null;
  }>;

  selected_document_id: string | null;
  on_select_document: (id: string | null) => void;

  // Explicit current chat type - self-contained
  current_chat?: {
    document_ids?: Array<string> | null;
  } | null;

  document_viewer?: React.ComponentType<any>;
  disabled?: boolean;
}

export function AttemptDocumentArea({
  visible,
  documents,
  selected_document_id,
  on_select_document,
  current_chat,
  document_viewer: DocumentViewerComponent = DocumentViewer,
  disabled = false,
}: DocumentAreaProps) {
  if (!visible) return null;

  // Filter documents for current chat's scenario
  const currentChatDocIds = current_chat?.document_ids || [];
  const filteredDocs = documents.filter(
    (doc) => doc.document_id && currentChatDocIds.includes(doc.document_id)
  );

  if (filteredDocs.length === 0) return null;

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
            {/* Select dropdown directly above document */}
            {filteredDocs.length > 1 && (
              <div className="p-2 pb-1.5 border-b">
                <DocumentSelect
                  documents={filteredDocs
                    .filter(
                      (doc): doc is typeof doc & { document_id: string } =>
                        !!doc.document_id
                    )
                    .map((doc) => ({
                      document_id: doc.document_id!,
                      name: doc.name || "",
                      updated_at: doc.updated_at || "",
                      extension: doc.extension || "",
                      scenario_ids: doc.scenario_ids || [],
                      can_edit: doc.can_edit ?? false,
                      can_delete: doc.can_delete ?? false,
                      active: doc.active ?? false,
                      department_ids: doc.department_ids,
                      upload_id: doc.upload_id,
                      field_ids: doc.field_ids || [],
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                    }))}
                  selectedDocumentId={selected_document_id}
                  onDocumentSelect={on_select_document}
                />
              </div>
            )}
            {/* Document viewer */}
            <div className="flex-1 min-h-0 px-1 py-3">
              {selected_document_id &&
                (() => {
                  const document =
                    filteredDocs.find(
                      (doc) =>
                        doc.document_id &&
                        doc.document_id === selected_document_id
                    ) ||
                    (filteredDocs[0]?.document_id ? filteredDocs[0] : null);
                  return document ? (
                    <DocumentViewerComponent
                      key={selected_document_id}
                      document={{
                        document_id: document.document_id!,
                        name: document.name || "",
                        updated_at: document.updated_at || "",
                        extension: document.extension || "",
                        scenario_ids: document.scenario_ids || [],
                        can_edit: document.can_edit ?? false,
                        can_delete: document.can_delete ?? false,
                        active: document.active ?? false,
                        department_ids: document.department_ids,
                        upload_id: document.upload_id,
                        field_ids: document.field_ids || [],
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                      }}
                    />
                  ) : null;
                })()}
            </div>
          </CardContent>
        </Card>
      </ResizablePanel>
    </>
  );
}
