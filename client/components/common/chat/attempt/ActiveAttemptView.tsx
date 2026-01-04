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
type ChatsArray = NonNullable<AttemptFullOut["chats"]>;
type ChatDataType = ChatsArray extends Array<infer T> ? T : never;
type Chat = ChatDataType["chat"];
type ScenarioItem = ChatDataType["scenario"];
type ScenarioDocumentItem = NonNullable<AttemptFullOut["scenario_documents"]>[number];
type DynamicRubric = ChatDataType["dynamic_rubric"];
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
                              {(() => {
                                const currentScenario = displayChat?.id
                                  ? scenariosByChatId[displayChat.id]
                                  : scenario;
                                const shouldShowProblemStatement =
                                  currentScenario?.show_problem_statement !== false;
                                return shouldShowProblemStatement ? (
                                  <span className="font-medium">
                                    {scenario?.problem_statement ||
                                      scenario?.name ||
                                      currentChat?.title}
                                  </span>
                                ) : (
                                  <span className="font-medium">
                                    {scenario?.name || currentChat?.title}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-start justify-end gap-2">
                            <div className="flex items-center gap-4">
                              {/* Hide completed badge logic in infinite mode */}
                              {!attempt?.infinite_mode &&
                                currentChat?.completed &&
                                expectedChatCount ===
                                  chats.filter((chat) => chat?.completed)
                                    .length && (
                                  <Badge variant="default">Completed</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Objectives Toggle - only show if simulation has objectives enabled, scenario has showObjectives enabled, and current chat scenario has objectives */}
                              {simulation?.objectives_enabled &&
                                (() => {
                                  const currentScenario = displayChat?.id
                                    ? scenariosByChatId[displayChat.id]
                                    : scenario;
                                  const shouldShowObjectives =
                                    currentScenario?.show_objectives !== false;
                                  const hasObjectives =
                                    currentScenario?.objectives &&
                                    currentScenario.objectives.length > 0;
                                  return shouldShowObjectives && hasObjectives;
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
                                  displayChat?.document_ids || [];
                                const hasDocumentsForCurrentChat =
                                  scenarioDocuments?.some((doc) =>
                                    doc.document_id && currentChatDocIds.includes(doc.document_id),
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
                                      !attempt?.infinite_mode &&
                                      currentChat?.completed &&
                                      currentDynamicRubric &&
                                      expectedChatCount ===
                                        chats.filter((chat) => chat?.completed)
                                          .length
                                        ? currentDynamicRubric?.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {attempt?.infinite_mode ? (
                                      <InfinityIcon className="h-4 w-4 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        attempt?.infinite_mode
                                          ? ""
                                          : simulation?.time_limit &&
                                              timer.remaining !== null &&
                                              timer.remaining < 0
                                            ? "text-red-500"
                                            : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {attempt?.infinite_mode
                                        ? simulation?.time_limit
                                          ? formatTime(
                                              Math.max(timer.remaining || 0, 0),
                                            )
                                          : formatTime(timer.elapsed)
                                        : simulation?.time_limit &&
                                            timer.remaining !== null
                                          ? formatTime(timer.remaining)
                                          : formatTime(timer.elapsed)}
                                    </span>
                                    {/* In infinite mode, we don't show negative state; we auto-finish on expiry */}
                                  </div>
                                </TooltipTrigger>
                                {!attempt?.infinite_mode &&
                                  currentChat?.completed &&
                                  currentDynamicRubric &&
                                  expectedChatCount ===
                                    chats.filter((chat) => chat?.completed)
                                      .length && (
                                    <TooltipContent>
                                      <p>
                                        {currentDynamicRubric.passed
                                          ? "Passed"
                                          : "Failed"}
                                        ({currentDynamicRubric?.score}/
                                        {
                                          currentDynamicRubric?.total_possible_points
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
                      {simulation?.objectives_enabled &&
                        (() => {
                          const currentScenario = displayChat?.id
                            ? scenariosByChatId[displayChat.id]
                            : scenario;
                          const shouldShowObjectives =
                            currentScenario?.show_objectives !== false;
                          const objectives = currentScenario?.objectives || [];
                          return shouldShowObjectives && objectives.length > 0;
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
                    {!attempt?.infinite_mode && expectedChatCount > 1 && (
                      <div className="p-0">
                        {/* Progress bar would go here if needed */}
                      </div>
                    )}
                    <AttemptMessages
                      isAttemptOwner={isAttemptOwner}
                      messages={currentMessages}
                      currentChat={
                        currentChat
                          ? {
                              id: currentChat.id || "",
                              ...(typeof currentChat.completed === "boolean" ? { completed: currentChat.completed } : {}),
                            }
                          : null
                      }
                      sendMessage={sendMessage}
                      isSendingMessage={isSendingMessage}
                      isActive={!timer.expired}
                      simulation={simulation ? { ...(typeof simulation.time_limit === "number" ? { timeLimit: simulation.time_limit } : {}), ...(typeof simulation.practice_simulation === "boolean" ? { practiceSimulation: simulation.practice_simulation } : {}) } : null}
                      currentChatHints={currentChatHints}
                      personas={personas ?? []}
                      scenario={scenario ? { personaName: scenario.persona_name, personaIcon: scenario.persona_icon, personaColor: scenario.persona_color } : null}
                      backgroundImage={
                        (() => {
                          const currentScenario = displayChat?.id
                            ? scenariosByChatId[displayChat.id]
                            : scenario;
                          const shouldShowImages =
                            currentScenario?.show_images !== false;
                          return shouldShowImages &&
                            currentScenario?.background_image
                            ? currentScenario.background_image
                            : null;
                        })()
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
                    currentChat={
                      currentChat
                        ? {
                            id: currentChat.id || "",
                            ...(typeof currentChat.completed === "boolean" ? { completed: currentChat.completed } : {}),
                          }
                        : null
                    }
                    sendMessage={sendMessage}
                    stopMessage={stopMessage}
                    isSendingMessage={isSendingMessage}
                    isStoppingMessage={isStoppingMessage}
                    isConnected={isConnected}
                    simulation={simulation ? { ...(typeof simulation.practice_simulation === "boolean" ? { practiceSimulation: simulation.practice_simulation } : {}), ...(typeof simulation.copy_paste_allowed === "boolean" ? { copyPasteAllowed: simulation.copy_paste_allowed } : {}) } : null}
                    scenario={scenario ? { ...(typeof scenario.copy_paste_allowed === "boolean" ? { copyPasteAllowed: scenario.copy_paste_allowed } : {}), ...(typeof scenario.text_enabled === "boolean" ? { textEnabled: scenario.text_enabled } : {}), ...(typeof scenario.audio_enabled === "boolean" ? { audioEnabled: scenario.audio_enabled } : {}) } : null}
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
            const currentChatDocIds = displayChat?.document_ids || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                doc.document_id && currentChatDocIds.includes(doc.document_id),
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
                              documents={filteredDocs
                                .filter((doc): doc is ScenarioDocumentItem & { document_id: string } => 
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
                      doc.document_id && doc.document_id === selectedDocumentId,
                  ) || (filteredDocs[0]?.document_id ? filteredDocs[0] : null);
                              return document ? (
                                <DocumentViewer
                                  key={selectedDocumentId}
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
                const currentChatDocIds = displayChat?.document_ids || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    doc.document_id && currentChatDocIds.includes(doc.document_id),
                  ) || [];
                return (
                  (selectedDocumentId ? filteredDocs.find(
                    (doc) => doc.document_id && doc.document_id === selectedDocumentId,
                  )?.name : null) ||
                  filteredDocs[0]?.name ||
                  "Document"
                );
              })()}
            </DialogTitle>
            <DialogDescription>View scenario document</DialogDescription>
          </DialogHeader>

          {/* Document selector (if multiple documents) */}
          {(() => {
            const currentChatDocIds = displayChat?.document_ids || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                doc.document_id && currentChatDocIds.includes(doc.document_id),
              ) || [];
            return filteredDocs.length > 1 ? (
              <div className="pb-3">
                <DocumentSelect
                  documents={filteredDocs
                    .filter((doc): doc is ScenarioDocumentItem & { document_id: string } => 
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
                const currentChatDocIds = displayChat?.document_ids || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    doc.document_id && currentChatDocIds.includes(doc.document_id),
                  ) || [];
                const document =
                  filteredDocs.find(
                    (doc) => doc.document_id && doc.document_id === selectedDocumentId,
                  ) || filteredDocs[0];
                return document ? (
                  <DocumentViewer
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
                    bare={true}
                  />
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
