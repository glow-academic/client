/**
 * ActiveAttemptView.tsx
 * Active (non-graded) attempt view with input and documents
 * @AshokSaravanan222 & @siladiea
 * 01/30/2025
 */
"use client";

import type { AttemptFullOut } from "@/app/(main)/home/a/[attemptId]/page";
import { ImperativePanelGroupHandle } from "react-resizable-panels";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Icons
import {
  CheckCircle2,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  ListChecks,
} from "lucide-react";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { formatTime } from "@/utils/time";
import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";

// Extract types from AttemptFullOut
type ChatDataType = AttemptFullOut["chats"][number];
type Chat = ChatDataType["chat"];
type ScenarioItem = ChatDataType["scenario"];
type ScenarioDocumentItem = AttemptFullOut["scenarioDocuments"][number];
type DynamicRubric = ChatDataType["dynamicRubric"];
type AttemptItem = AttemptFullOut["attempt"];
type SimulationItem = AttemptFullOut["simulation"];

interface ActiveAttemptViewProps {
  attemptId: string;
  attempt: AttemptItem | null;
  simulation: SimulationItem | null;
  scenario: ScenarioItem | null;
  currentChat: Chat | null;
  displayChat: Chat | null;
  chats: Chat[];
  expectedChatCount: number;
  scenarioDocuments: ScenarioDocumentItem[];
  scenariosByChatId: Record<string, ScenarioItem | null>;
  currentDynamicRubric: DynamicRubric | null;
  timer: {
    elapsed: number;
    remaining: number | null;
    expired: boolean;
  };
  showDocuments: boolean;
  showDocumentModal: boolean;
  showObjectives: boolean;
  showObjectivesModal: boolean;
  showGrades: boolean;
  selectedDocumentId: string | null;
  inputPanelHeight: number;
  inputPanelGroupRef: React.RefObject<ImperativePanelGroupHandle>;
  currentMessages: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
    completed?: boolean;
    personaId?: string;
  }>;
  currentChatHints: Array<{
    messageId: string;
    hints: Array<{
      simulationMessageId: string;
      hint: string;
      idx: number;
      createdAt: string;
    }>;
  }>;
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;
  isAttemptOwner: boolean;
  isSendingMessage: boolean;
  isStoppingMessage: boolean;
  isConnected: boolean;
  sendMessage: (message: string, isRetry?: boolean) => void;
  stopMessage: () => void;
  setShowDocuments: (show: boolean) => void;
  setShowDocumentModal: (show: boolean) => void;
  setShowObjectives: (show: boolean) => void;
  setShowObjectivesModal: (show: boolean) => void;
  setSelectedDocumentId: (id: string | null) => void;
  onHeightChange: (height: number) => void;
}

export default function ActiveAttemptView({
  attemptId,
  attempt,
  simulation,
  scenario,
  currentChat,
  displayChat,
  chats,
  expectedChatCount,
  scenarioDocuments,
  scenariosByChatId,
  currentDynamicRubric,
  timer,
  showDocuments,
  showDocumentModal,
  showObjectives,
  showObjectivesModal,
  showGrades,
  selectedDocumentId,
  inputPanelHeight,
  inputPanelGroupRef,
  currentMessages,
  currentChatHints,
  personas,
  isAttemptOwner,
  isSendingMessage,
  isStoppingMessage,
  isConnected,
  sendMessage,
  stopMessage,
  setShowDocuments,
  setShowDocumentModal,
  setShowObjectives,
  setShowObjectivesModal,
  setSelectedDocumentId,
  onHeightChange,
}: ActiveAttemptViewProps) {
  return (
    <div
      className="h-[calc(100vh-4rem)]"
      data-testid="attempt-chat-container"
      data-attempt-id={attemptId || ""}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chat Area */}
        <ResizablePanel
          defaultSize={showDocuments && scenarioDocuments.length > 0 ? 70 : 100}
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-2 border-0 rounded-t-xl rounded-b-none">
            <TooltipProvider>
              <ResizablePanelGroup
                ref={inputPanelGroupRef}
                direction="vertical"
                className="h-full"
              >
                <ResizablePanel defaultSize={88} minSize={70}>
                  <div className="h-full flex flex-col">
                    {/* Timer and Controls Header */}
                    <Collapsible
                      open={showObjectives}
                      onOpenChange={setShowObjectives}
                      className="border-b"
                    >
                      <div className="p-2 pt-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-start gap-2">
                              <span className="font-medium">
                                {scenario?.problemStatement ||
                                  scenario?.name ||
                                  currentChat?.title}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start justify-end gap-2">
                            <div className="flex items-center gap-4">
                              {/* Hide completed badge logic in infinite mode */}
                              {!attempt?.infiniteMode &&
                                currentChat?.completed &&
                                expectedChatCount ===
                                  chats.filter((chat) => chat.completed)
                                    .length && (
                                  <Badge variant="default">Completed</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Objectives Toggle - only show if simulation has objectives enabled and current chat scenario has objectives */}
                              {simulation?.objectivesEnabled &&
                                (() => {
                                  const currentScenario = displayChat?.id
                                    ? scenariosByChatId[displayChat.id]
                                    : null;
                                  const hasObjectives =
                                    currentScenario?.objectives &&
                                    currentScenario.objectives.length > 0;
                                  return hasObjectives;
                                })() && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant={
                                            showObjectives
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={(e) => {
                                            // Mobile: open modal, Desktop: use collapsible
                                            if (window.innerWidth < 768) {
                                              e.preventDefault();
                                              setShowObjectivesModal(true);
                                            }
                                          }}
                                          className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                        >
                                          <ListChecks className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {showObjectives
                                          ? "Hide Objectives"
                                          : "Show Objectives"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                              {(() => {
                                const currentChatDocIds =
                                  displayChat?.documentIds || [];
                                const hasDocumentsForCurrentChat =
                                  scenarioDocuments?.some((doc) =>
                                    currentChatDocIds.includes(doc.document_id)
                                  );
                                return hasDocumentsForCurrentChat;
                              })() && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments || showDocumentModal
                                          ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (window.innerWidth < 768) {
                                          setShowDocumentModal(true);
                                        } else {
                                          setShowDocuments(!showDocuments);
                                        }
                                      }}
                                      className={`p-2 ${showDocuments || showDocumentModal ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments || showDocumentModal
                                        ? "Hide Documents"
                                        : "Show Documents"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center justify-center gap-2 px-3 py-1 rounded-full w-[85px] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                                      !attempt?.infiniteMode &&
                                      currentChat?.completed &&
                                      currentDynamicRubric &&
                                      expectedChatCount ===
                                        chats.filter((chat) => chat.completed)
                                          .length
                                        ? currentDynamicRubric?.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {attempt?.infiniteMode ? (
                                      <InfinityIcon className="h-4 w-4 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        attempt?.infiniteMode
                                          ? ""
                                          : simulation?.timeLimit &&
                                              timer.remaining !== null &&
                                              timer.remaining < 0
                                            ? "text-red-500"
                                            : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {attempt?.infiniteMode
                                        ? simulation?.timeLimit
                                          ? formatTime(
                                              Math.max(timer.remaining || 0, 0)
                                            )
                                          : formatTime(timer.elapsed)
                                        : simulation?.timeLimit &&
                                            timer.remaining !== null
                                          ? formatTime(timer.remaining)
                                          : formatTime(timer.elapsed)}
                                    </span>
                                    {/* In infinite mode, we don't show negative state; we auto-finish on expiry */}
                                  </div>
                                </TooltipTrigger>
                                {!attempt?.infiniteMode &&
                                  currentChat?.completed &&
                                  currentDynamicRubric &&
                                  expectedChatCount ===
                                    chats.filter((chat) => chat.completed)
                                      .length && (
                                    <TooltipContent>
                                      <p>
                                        {currentDynamicRubric.passed
                                          ? "Passed"
                                          : "Failed"}
                                        ({currentDynamicRubric?.score}/
                                        {
                                          currentDynamicRubric?.totalPossiblePoints
                                        }
                                        )
                                      </p>
                                    </TooltipContent>
                                  )}
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Objectives Collapsible Content - hide in grading mode */}
                      {simulation?.objectivesEnabled &&
                        (() => {
                          const currentScenario = displayChat?.id
                            ? scenariosByChatId[displayChat.id]
                            : null;
                          const objectives = currentScenario?.objectives || [];
                          return objectives.length > 0;
                        })() &&
                        !showGrades && (
                          <CollapsibleContent className="pt-2">
                            <div className="px-4 pb-2">
                              <ul className="space-y-2 list-none">
                                {(() => {
                                  const currentScenario = displayChat?.id
                                    ? scenariosByChatId[displayChat.id]
                                    : null;
                                  const objectives =
                                    currentScenario?.objectives || [];
                                  return objectives.map((objective, index) => (
                                    <li
                                      key={index}
                                      className="font-normal flex items-start gap-2"
                                    >
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                      <span className="flex-1 -mt-0.5">
                                        {objective}
                                      </span>
                                    </li>
                                  ));
                                })()}
                              </ul>
                            </div>
                          </CollapsibleContent>
                        )}
                    </Collapsible>

                    {/* Messages Area */}
                    {/* Progress Bar at the very top */}
                    {/* Hide progress bar in infinite mode */}
                    {!attempt?.infiniteMode && expectedChatCount > 1 && (
                      <div className="p-0">
                        {/* Progress bar would go here if needed */}
                      </div>
                    )}
                    <AttemptMessages
                      isAttemptOwner={isAttemptOwner}
                      messages={currentMessages}
                      currentChat={currentChat ? { id: currentChat.id || "", completed: currentChat.completed } : null}
                      sendMessage={sendMessage}
                      isSendingMessage={isSendingMessage}
                      isActive={!timer.expired}
                      simulation={simulation}
                      currentChatHints={currentChatHints}
                      personas={personas ?? []}
                      scenario={scenario}
                      backgroundImage={
                        // TODO: Determine background image dynamically here
                        // Example:  scenario?.imageUrl || '/classroom.jpg' || null
                        "/classroom.jpg"
                      }
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle disabled />
                {/* Input Area */}
                <div
                  style={{
                    height: `${inputPanelHeight}px`,
                    minHeight: "70px",
                    maxHeight: "160px",
                  }}
                >
                  <AttemptInput
                    isAttemptOwner={isAttemptOwner}
                    onHeightChange={onHeightChange}
                    currentMessages={currentMessages}
                    currentChatHints={currentChatHints}
                    currentChat={currentChat ? { id: currentChat.id || "", completed: currentChat.completed } : null}
                    sendMessage={sendMessage}
                    stopMessage={stopMessage}
                    isSendingMessage={isSendingMessage}
                    isStoppingMessage={isStoppingMessage}
                    isConnected={isConnected}
                    simulation={simulation}
                    scenario={scenario}
                    readOnly={false}
                  />
                </div>
              </ResizablePanelGroup>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments &&
          (() => {
            // Filter documents for current chat's scenario
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];

            return (
              filteredDocs.length > 0 && (
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
                              documents={filteredDocs}
                              selectedDocumentId={selectedDocumentId}
                              onDocumentSelect={setSelectedDocumentId}
                            />
                          </div>
                        )}
                        {/* Document viewer with minimal padding */}
                        <div className="flex-1 min-h-0 px-1 py-3">
                          {selectedDocumentId &&
                            (() => {
                              const document =
                                filteredDocs.find(
                                  (doc) =>
                                    doc.document_id === selectedDocumentId
                                ) || filteredDocs[0];
                              return document ? (
                                <DocumentViewer
                                  key={selectedDocumentId}
                                  document={document}
                                />
                              ) : null;
                            })()}
                        </div>
                      </CardContent>
                    </Card>
                  </ResizablePanel>
                </>
              )
            );
          })()}
      </ResizablePanelGroup>

      {/* Document Modal - Mobile Only */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent
          className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                return (
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  )?.name ||
                  filteredDocs[0]?.name ||
                  "Document"
                );
              })()}
            </DialogTitle>
            <DialogDescription>View scenario document</DialogDescription>
          </DialogHeader>

          {/* Document selector (if multiple documents) */}
          {(() => {
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];
            return filteredDocs.length > 1 ? (
              <div className="pb-3">
                <DocumentSelect
                  documents={filteredDocs}
                  selectedDocumentId={selectedDocumentId}
                  onDocumentSelect={setSelectedDocumentId}
                />
              </div>
            ) : null;
          })()}

          {/* Document viewer */}
          {selectedDocumentId && (
            <div className="flex-1 overflow-auto">
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                const document =
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  ) || filteredDocs[0];
                return document ? (
                  <DocumentViewer document={document} bare={true} />
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDocumentModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objectives Modal - Mobile Only */}
      <Dialog open={showObjectivesModal} onOpenChange={setShowObjectivesModal}>
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
            {(() => {
              const currentScenario = displayChat?.id
                ? scenariosByChatId[displayChat.id]
                : null;
              const objectives = currentScenario?.objectives || [];

              if (objectives.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic">
                    No objectives defined for this scenario.
                  </p>
                );
              }

              return (
                <ul className="space-y-2 list-none">
                  {objectives.map((objective, index) => (
                    <li
                      key={index}
                      className="font-medium flex items-start gap-2"
                    >
                      <span className="text-primary mt-1.5 flex-shrink-0">
                        •
                      </span>
                      <span className="flex-1">{objective}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowObjectivesModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
