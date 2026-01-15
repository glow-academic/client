/**
 * PreviewStep.tsx
 * Preview step component for scenario messages, hints, end conversation, and document preview
 * Extracted from ContentSection to separate preview logic
 */

"use client";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type StepStatus = "pending" | "active" | "completed";

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export interface PreviewStepProps {
  // Personas (for preview messages)
  selectedPersonaIds: string[];
  personaMapping: Record<
    string,
    {
      persona_id: string | null;
      name: string | null;
      description: string | null;
      color: string | null;
      icon: string | null;
      image_model: boolean | null;
      parameter_ids: string[] | null;
      field_ids: string[] | null;
      example: string | null;
    }
  >;

  // Documents Preview
  allPreviewDocumentIds: string[];
  documentMapping: Record<string, { name: string; [key: string]: unknown }>;
  documentDetails?: Array<{
    document_id: string;
    upload_id?: string | null;
    [key: string]: unknown;
  }>;
  scenarioPreviewDocumentId: string | null;
  onScenarioPreviewDocumentChange?: (docId: string | null) => void;
  onDocumentRemove: (docId: string) => void;

  // Video Preview
  useVideo: boolean;
  selectedVideo?: {
    id: string;
    name: string;
    length_seconds: number;
    upload_id?: string;
  } | null;

  // Image (for background when not using video)
  image?: {
    id: string;
    name: string;
    upload_id: string;
  } | null;

  // Step configuration
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  disabled?: boolean;
}

export function PreviewStep({
  selectedPersonaIds,
  personaMapping,
  allPreviewDocumentIds,
  documentMapping,
  documentDetails,
  scenarioPreviewDocumentId,
  onScenarioPreviewDocumentChange,
  onDocumentRemove,
  useVideo,
  selectedVideo,
  image,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  disabled = false,
}: PreviewStepProps) {
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );

  // State for document navigation
  const currentDocumentIndex = useMemo(() => {
    if (!scenarioPreviewDocumentId || allPreviewDocumentIds.length === 0) {
      return 0;
    }
    const index = allPreviewDocumentIds.indexOf(scenarioPreviewDocumentId);
    return index >= 0 ? index : 0;
  }, [scenarioPreviewDocumentId, allPreviewDocumentIds]);

  const goToPreviousDocument = () => {
    if (currentDocumentIndex > 0) {
      const previousDocId = allPreviewDocumentIds[currentDocumentIndex - 1];
      onScenarioPreviewDocumentChange?.(previousDocId ?? null);
    }
  };

  const goToNextDocument = () => {
    if (currentDocumentIndex < allPreviewDocumentIds.length - 1) {
      const nextDocId = allPreviewDocumentIds[currentDocumentIndex + 1];
      onScenarioPreviewDocumentChange?.(nextDocId ?? null);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
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
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Section */}
        <div className="flex gap-4 items-stretch">
          {/* Video/Image Preview Section */}
          <div
            className={
              allPreviewDocumentIds.length > 0
                ? "w-[70%] space-y-2 flex flex-col"
                : "w-full space-y-2 flex flex-col"
            }
          >
            {/* Video Preview Container (when video enabled) */}
            {useVideo && (
              <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1 bg-black flex items-center justify-center">
                {selectedVideo ? (
                  selectedVideo.upload_id ? (
                    <video
                      src={`/api/uploads/download/${selectedVideo.upload_id}`}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/70">
                      <Video className="h-12 w-12 mb-2" />
                      <p className="text-sm">Video upload not available</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/70">
                    <Video className="h-12 w-12 mb-2" />
                    <p className="text-sm">No video selected</p>
                  </div>
                )}
              </div>
            )}

            {/* Combined Image and Chat Preview Container (when video not enabled) */}
            {!useVideo && (
              <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1">
                {/* Background Image - only show if image exists */}
                {image && (
                  <div className="absolute inset-0 w-full h-full">
                    <ImageViewer
                      imageId={image.id}
                      name={image.name}
                      bare={true}
                    />
                  </div>
                )}

                {/* Background when no image */}
                {!image && (
                  <div className="absolute inset-0 w-full h-full bg-muted/20" />
                )}

                {/* Chat Preview Overlay - always show */}
                <div className="relative z-10 p-4 h-full min-h-[400px] flex flex-col justify-start">
                  <div className="space-y-3">
                    {/* TA/User message */}
                    <div className="flex justify-end mb-3">
                      <div className="max-w-[80%]">
                        <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-lg">
                          <p className="text-sm">Hi, how can I help you?</p>
                        </div>
                      </div>
                    </div>

                    {/* Assistant messages */}
                    {selectedPersonaIds.map((personaId) => {
                      const persona = personaMapping[personaId];
                      if (!persona) return null;

                      const IconComponent =
                        getPersonaIconComponent(persona.icon || "") ||
                        MessageSquare;
                      const hexColor = persona.color || "#64748b";
                      const buttonStyle = {
                        background: generateGradientFromHex(hexColor),
                      };

                      return (
                        <div
                          key={personaId}
                          className="flex justify-start mb-3"
                        >
                          <div className="max-w-[80%] flex items-stretch gap-2">
                            <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-visible">
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={persona.name || undefined}
                                className="flex-1 p-0 rounded-md shadow-md"
                                style={buttonStyle}
                                tabIndex={-1}
                              >
                                <IconComponent className="h-4 w-4 text-white" />
                              </Button>
                            </div>
                            <div className="bg-muted/95 backdrop-blur-sm rounded-lg p-3 flex-1 shadow-lg">
                              <p className="text-sm">
                                {persona.example ||
                                  "I'd be happy to help you with that. Let me provide some guidance..."}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Show placeholder if no personas selected */}
                    {selectedPersonaIds.length === 0 && (
                      <div className="flex justify-start mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-visible">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 p-0 rounded-md shadow-md"
                              tabIndex={-1}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-muted/95 backdrop-blur-sm rounded-lg p-3 flex-1 shadow-lg">
                            <p className="text-sm text-muted-foreground italic">
                              Select personas to see preview messages
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Documents Preview Section */}
          {allPreviewDocumentIds.length > 0 && (
            <div className="w-[30%] min-w-[30%] max-w-[30%] space-y-2 flex flex-col self-stretch">
              {/* Document Navigation - Top Right */}
              {scenarioPreviewDocumentId &&
                allPreviewDocumentIds.length > 1 && (
                  <div className="flex items-center justify-between">
                    <Label>Documents</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={goToPreviousDocument}
                        disabled={currentDocumentIndex === 0 || isReadonly}
                      >
                        <span className="sr-only">Go to previous document</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                        {currentDocumentIndex + 1}/{allPreviewDocumentIds.length}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={goToNextDocument}
                        disabled={
                          currentDocumentIndex >=
                            allPreviewDocumentIds.length - 1 || isReadonly
                        }
                      >
                        <span className="sr-only">Go to next document</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              {(!scenarioPreviewDocumentId ||
                allPreviewDocumentIds.length <= 1) && <Label>Documents</Label>}

              {/* Document Preview Container */}
              {scenarioPreviewDocumentId &&
                (() => {
                  let previewDocId = scenarioPreviewDocumentId;
                  const previewDoc = documentDetails?.find(
                    (d) => d.document_id === previewDocId
                  );

                  // If preview doc is a template, check if we have a child for it
                  if (previewDoc?.["is_template"]) {
                    const childDoc = documentDetails?.find(
                      (d) =>
                        (d as { parent_document_id?: string })
                          ?.parent_document_id === previewDocId
                    );
                    if (childDoc) {
                      previewDocId = childDoc.document_id;
                    }
                  }

                  const docId = previewDocId;
                  const fullDoc = documentDetails?.find(
                    (d) => d.document_id === docId
                  );
                  const parentDocumentId = (
                    fullDoc as {
                      parent_document_id?: string;
                    }
                  )?.parent_document_id;
                  const isChildDocument = Boolean(parentDocumentId);
                  const isTemplateDocument =
                    !isChildDocument && Boolean(fullDoc?.["is_template"]);

                  const docForViewer: DocumentItem = fullDoc
                    ? ({
                        document_id: fullDoc.document_id,
                        name:
                          (fullDoc as { name?: string }).name ||
                          documentMapping[docId]?.name ||
                          "Document",
                        updated_at:
                          (fullDoc as { updated_at?: string }).updated_at ||
                          new Date().toISOString(),
                        extension:
                          (fullDoc as { extension?: string }).extension || "",
                        scenario_ids:
                          (fullDoc as { scenario_ids?: string[] })
                            ?.scenario_ids || [],
                        can_edit:
                          (fullDoc as { can_edit?: boolean }).can_edit || false,
                        can_delete:
                          (fullDoc as { can_delete?: boolean }).can_delete ||
                          false,
                        active:
                          (fullDoc as { active?: boolean }).active ?? true,
                        department_ids:
                          (fullDoc as { department_ids?: string[] | null })
                            ?.department_ids || null,
                        upload_id: fullDoc.upload_id ?? null,
                        parameter_item_ids: [],
                        field_ids: [],
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                      } as DocumentItem)
                    : ({
                        document_id: docId,
                        name: documentMapping[docId]?.name || "Document",
                        updated_at: new Date().toISOString(),
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                        extension: "",
                        scenario_ids: [],
                        can_edit: false,
                        can_delete: false,
                        active: true,
                        department_ids: null,
                        field_ids: [],
                        parameter_item_ids: [],
                        upload_id: null,
                      } as DocumentItem);

                  const documentName =
                    docForViewer.name ||
                    documentMapping[docId]?.name ||
                    "Document";

                  const handleDocumentDelete = () => {
                    if (isReadonly) return;
                    onDocumentRemove(docId);
                    const currentIndex = allPreviewDocumentIds.indexOf(docId);
                    if (currentIndex >= 0) {
                      if (allPreviewDocumentIds.length > 1) {
                        const nextIndex =
                          currentIndex < allPreviewDocumentIds.length - 1
                            ? currentIndex + 1
                            : currentIndex - 1;
                        const nextDocId = allPreviewDocumentIds[nextIndex];
                        onScenarioPreviewDocumentChange?.(nextDocId ?? null);
                      } else {
                        onScenarioPreviewDocumentChange?.(null);
                      }
                    }
                  };

                  return (
                    <div className="relative border rounded-lg overflow-hidden flex-1 min-h-[400px]">
                      {/* Preview button - top left */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDocumentId(docId);
                        }}
                        className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewDocumentId(docId);
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      {/* Delete button - top right */}
                      {!isReadonly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDocumentDelete();
                          }}
                          className="absolute top-1 right-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-primary-foreground" />
                        </button>
                      )}
                      <>
                        <div
                          className={cn(
                            "h-full overflow-auto flex items-center justify-center [&>div]:!min-h-0 [&_iframe]:!min-h-0",
                            isTemplateDocument && "opacity-20"
                          )}
                          style={{
                            overflowX: "auto",
                            overflowY: "auto",
                          }}
                        >
                          <div className="w-full h-auto max-h-full">
                            <DocumentViewer
                              document={docForViewer}
                              bare={true}
                              isFormDocument={false}
                              compact={true}
                            />
                          </div>
                        </div>
                        {isTemplateDocument && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <p className="text-sm font-medium text-foreground px-4 py-2 rounded text-center">
                              Document will be automatically generated from this
                              template
                            </p>
                          </div>
                        )}
                      </>
                      {/* Document name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                        <span className="truncate block">{documentName}</span>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>

        {/* Document Preview Dialog */}
        <Dialog
          open={previewDocumentId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewDocumentId(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {previewDocumentId
                  ? documentMapping[previewDocumentId]?.name ||
                    (
                      documentDetails?.find(
                        (d) => d.document_id === previewDocumentId
                      ) as { name?: string } | undefined
                    )?.name ||
                    "Document Preview"
                  : "Document Preview"}
              </DialogTitle>
              <DialogDescription>Preview document content</DialogDescription>
            </DialogHeader>
            {previewDocumentId &&
              (() => {
                const docId = previewDocumentId;
                const fullDoc = documentDetails?.find(
                  (d) => d.document_id === docId
                );

                const docForViewer: DocumentItem = fullDoc
                  ? ({
                      document_id: fullDoc.document_id,
                      name:
                        (fullDoc as { name?: string }).name ||
                        documentMapping[docId]?.name ||
                        "Document",
                      updated_at:
                        (fullDoc as { updated_at?: string }).updated_at ||
                        new Date().toISOString(),
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                      extension:
                        (fullDoc as { extension?: string }).extension || "",
                      scenario_ids:
                        (fullDoc as { scenario_ids?: string[] }).scenario_ids ||
                        [],
                      can_edit:
                        (fullDoc as { can_edit?: boolean }).can_edit || false,
                      can_delete:
                        (fullDoc as { can_delete?: boolean }).can_delete ||
                        false,
                      active: (fullDoc as { active?: boolean }).active ?? true,
                      department_ids:
                        (fullDoc as { department_ids?: string[] | null })
                          ?.department_ids || null,
                      upload_id: fullDoc.upload_id ?? null,
                      parameter_item_ids: [],
                      field_ids: [],
                    } as DocumentItem)
                  : ({
                      document_id: docId,
                      name: documentMapping[docId]?.name || "Document",
                      updated_at: new Date().toISOString(),
                      extension: "",
                      scenario_ids: [],
                      can_edit: false,
                      can_delete: false,
                      active: true,
                      department_ids: null,
                      field_ids: [],
                      parameter_item_ids: [],
                      upload_id: null,
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                    } as DocumentItem);

                return (
                  <div className="w-full h-[calc(90vh-120px)] overflow-auto">
                    <DocumentViewer
                      document={docForViewer}
                      bare={true}
                      isFormDocument={false}
                      compact={false}
                    />
                  </div>
                );
              })()}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
