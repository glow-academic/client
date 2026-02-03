/**
 * GenericChatInterface.tsx
 * Main orchestrator component (like Persona.tsx)
 * Accepts pluggable components as props and manages layout
 * All data and handlers flow through props - no database dependencies
 */
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import React from "react";

// Import component prop types (each component defines its own)
import type { components } from "@/lib/api/schema";
import type { MessagesViewProps } from "../chatAreas/MessagesView";
import type { QuestionReviewViewProps } from "../chatAreas/QuestionReviewView";
import type { RubricViewProps } from "../chatAreas/RubricView";
import type { VideoViewProps } from "../chatAreas/VideoView";
import type { ChatHeaderProps } from "../chatHeaders/AttemptChatHeader";
import type { DocumentAreaProps } from "../documentAreas/AttemptDocumentArea";
import type { QuestionTakingInputProps } from "../inputAreas/QuestionTakingInput";
import type { TextInputProps } from "../inputAreas/TextInput";
import type { VoiceInputProps } from "../inputAreas/VoiceInput";

type ImageEntry = components["schemas"]["ImageEntry"];

export type ChatAreaViewMode =
  | "messages"
  | "graded-messages"
  | "video"
  | "graded-video"
  | "rubric";

export interface GenericChatInterfaceProps {
  // Pluggable components (like resource components in Persona.tsx)
  chat_header: React.ComponentType<ChatHeaderProps>;
  chat_area: React.ComponentType<
    | MessagesViewProps
    | VideoViewProps
    | RubricViewProps
    | QuestionReviewViewProps
  >;
  document_area?: React.ComponentType<DocumentAreaProps>;
  input_area: React.ComponentType<
    TextInputProps | VoiceInputProps | QuestionTakingInputProps
  >;
  input_area_ref?: React.Ref<unknown>;

  // View mode for chat area
  chat_area_view_mode: ChatAreaViewMode;

  // Handler props (WebSocket orchestration callbacks)
  on_send_message: (message: string) => void;
  on_stop_message: () => void;
  on_voice_start?: () => Promise<void>;
  on_voice_stop?: () => Promise<void>;

  // Configuration props
  layout?: "default" | "custom";
  show_documents?: boolean;
  show_document_modal?: boolean;
  show_objectives_modal?: boolean;
  input_panel_height?: number;

  // Standard props
  disabled?: boolean;
  hide_input_area?: boolean;

  // Pagination footer (rendered at bottom, inside the layout)
  pagination_footer?: React.ReactNode;

  // Background image (rendered behind the chat area)
  background_image?: ImageEntry | null;

  // Data props are passed via render props - each component receives its own data
  // These are passed to child components by the setup file
  chat_header_props: ChatHeaderProps;
  chat_area_props:
    | MessagesViewProps
    | VideoViewProps
    | RubricViewProps
    | QuestionReviewViewProps;
  document_area_props?: DocumentAreaProps;
  input_area_props: TextInputProps | VoiceInputProps | QuestionTakingInputProps;
}

export function GenericChatInterface({
  chat_header: ChatHeader,
  chat_area: ChatArea,
  document_area: DocumentArea,
  input_area: InputArea,
  chat_area_view_mode,
  on_send_message,
  on_stop_message,
  on_voice_start,
  on_voice_stop,
  layout = "default",
  show_documents = false,
  show_document_modal = false,
  show_objectives_modal = false,
  input_panel_height = 70,
  disabled = false,
  hide_input_area = false,
  pagination_footer,
  background_image,
  chat_header_props,
  chat_area_props,
  document_area_props,
  input_area_props,
  input_area_ref,
}: GenericChatInterfaceProps) {
  const backgroundImageUrl = background_image?.upload_id
    ? `/api/uploads/download/${background_image.upload_id}`
    : null;

  return (
    <div
      className="h-[calc(100vh-4rem)] flex flex-col"
      data-testid="generic-chat-interface"
    >
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Main Chat Area */}
        <ResizablePanel
          defaultSize={show_documents && document_area_props ? 70 : 100}
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-2 border-0 rounded-t-xl rounded-b-none bg-transparent">
            <div className="h-full flex flex-col">
              {/* Header - has its own background */}
              <div className="bg-card">
                <ChatHeader {...chat_header_props} disabled={disabled} />
              </div>

              {/* Messages/Rubric/Video Area */}
              <div
                className={cn(
                  "min-h-0 flex flex-col relative",
                  // Add flex-1 for non-video modes, or video mode when input is hidden
                  (chat_area_view_mode !== "video" || hide_input_area) && "flex-1"
                )}
              >
                {/* Background image layer - only behind messages area */}
                {backgroundImageUrl && chat_area_view_mode !== "rubric" && (
                  <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                      backgroundImage: `url('${backgroundImageUrl}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      opacity: 0.4,
                    }}
                  />
                )}
                {chat_area_view_mode === "video" ? (
                  <div className={cn("px-1 relative z-10", hide_input_area && "h-full")}>
                    <ChatArea {...(chat_area_props as any)} />
                  </div>
                ) : (
                  <ScrollArea className="flex-1 px-1 min-h-0 relative z-10">
                    <ChatArea {...(chat_area_props as any)} />
                  </ScrollArea>
                )}
              </div>

              {/* Input Area - collapse in graded view modes or when explicitly hidden */}
              {!hide_input_area &&
                chat_area_view_mode !== "rubric" &&
                chat_area_view_mode !== "graded-messages" &&
                chat_area_view_mode !== "graded-video" && (
                  <div
                    className={cn(
                      chat_area_view_mode === "video" &&
                        "flex-1 min-h-0 overflow-auto"
                    )}
                    style={
                      chat_area_view_mode !== "video"
                        ? {
                            height: `${input_panel_height}px`,
                            minHeight: "70px",
                            maxHeight: "160px",
                          }
                        : undefined
                    }
                  >
                    {input_area_ref ? (
                      <InputArea
                        ref={input_area_ref as any}
                        {...(input_area_props as any)}
                      />
                    ) : (
                      <InputArea {...(input_area_props as any)} />
                    )}
                  </div>
                )}
            </div>
          </Card>
        </ResizablePanel>

        {/* Document Area */}
        {show_documents && DocumentArea && document_area_props && (
          <DocumentArea
            {...document_area_props}
            disabled={disabled}
            is_graded_view={
              chat_area_view_mode === "rubric" ||
              chat_area_view_mode === "graded-messages" ||
              chat_area_view_mode === "graded-video"
            }
          />
        )}
      </ResizablePanelGroup>

      {/* Pagination Footer */}
      {pagination_footer}

      {/* Document Modal - Mobile Only */}
      {show_document_modal && document_area_props && (
        <Dialog open={show_document_modal} onOpenChange={() => {}}>
          <DialogContent
            className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>
                {document_area_props.documents.find(
                  (doc) =>
                    doc.document_id === document_area_props.selected_document_id
                )?.name || "Document"}
              </DialogTitle>
              <DialogDescription>View scenario document</DialogDescription>
            </DialogHeader>
            {/* Document content would be rendered here */}
            <DialogFooter>
              <Button variant="outline" onClick={() => {}}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Objectives Modal - Mobile Only */}
      {show_objectives_modal && chat_header_props.objectives && (
        <Dialog open={show_objectives_modal} onOpenChange={() => {}}>
          <DialogContent
            className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>Learning Objectives</DialogTitle>
              <DialogDescription>
                View the learning objectives for this scenario
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto py-4">
              <ul className="space-y-2 list-none">
                {chat_header_props.objectives.map((objective, index) => (
                  <li
                    key={index}
                    className="font-normal flex items-start gap-2"
                  >
                    <span className="text-primary mt-1.5 flex-shrink-0">•</span>
                    <span className="flex-1">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {}}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
