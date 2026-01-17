/**
 * AttemptChatSetup.tsx
 * Setup file that wires components together (like Persona.tsx)
 * Handles WebSocket orchestration and passes components/data to GenericChatInterface
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { GradedMessagesViewProps } from "../chatAreas/GradedMessagesView";
import { GradedMessagesView } from "../chatAreas/GradedMessagesView";
import type { MessagesViewProps } from "../chatAreas/MessagesView";
import { MessagesView } from "../chatAreas/MessagesView";
import type { RubricViewProps } from "../chatAreas/RubricView";
import { RubricView } from "../chatAreas/RubricView";
import type { VideoViewProps } from "../chatAreas/VideoView";
import { VideoView } from "../chatAreas/VideoView";
import type { ChatHeaderProps } from "../chatHeaders/AttemptChatHeader";
import { AttemptChatHeader } from "../chatHeaders/AttemptChatHeader";
import type { DocumentAreaProps } from "../documentAreas/AttemptDocumentArea";
import { AttemptDocumentArea } from "../documentAreas/AttemptDocumentArea";
import {
  GenericChatInterface,
  type ChatAreaViewMode,
} from "../generic/GenericChatInterface";
import type { QuestionResponsesInputProps } from "../inputAreas/QuestionResponsesInput";
import { QuestionResponsesInput } from "../inputAreas/QuestionResponsesInput";
import type { TextInputProps } from "../inputAreas/TextInput";
import { TextInput } from "../inputAreas/TextInput";
import type { VoiceInputProps } from "../inputAreas/VoiceInput";
import { VoiceInput } from "../inputAreas/VoiceInput";

// Explicit, self-contained types for setup props
export interface AttemptChatSetupProps {
  attempt_id: string;

  // Explicit attempt data type - self-contained
  attempt_data: {
    attempt?: {
      id: string;
      infinite_mode?: boolean | null;
    } | null;
    simulation?: {
      id: string;
      title: string | null;
      time_limit?: number | null;
      practice_simulation?: boolean | null;
      objectives_enabled?: boolean | null;
      copy_paste_allowed?: boolean | null;
    } | null;
    chats?: Array<{
      chat?: {
        id: string;
        title: string | null;
        completed?: boolean | null;
        created_at: string | null;
        updated_at: string | null;
        completed_at: string | null;
        document_ids?: Array<string> | null;
      } | null;
      scenario?: {
        id: string;
        name: string | null;
        problem_statement?: string | null;
        persona_name?: string | null;
        persona_icon?: string | null;
        persona_color?: string | null;
        show_problem_statement?: boolean | null;
        show_objectives?: boolean | null;
        show_images?: boolean | null;
        background_image?: string | null;
        copy_paste_allowed?: boolean | null;
        text_enabled?: boolean | null;
        audio_enabled?: boolean | null;
        objectives?: Array<string> | null;
      } | null;
      messages?: Array<{
        id: string;
        type: string;
        content: string;
        created_at: string;
        completed?: boolean | null;
        persona_id?: string | null;
        feedbacks?: Array<{
          id: string;
          name: string;
          description: string;
          type: "strength" | "improvement";
          replaces: Array<{
            section: string;
            replace: string;
          }>;
          highlights: Array<{
            section: string;
          }>;
        }>;
      }>;
      personas?: Array<{
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
      }>;
      hints?: Array<{
        message_id: string | null;
        hints: Array<{
          simulation_message_id: string | null;
          hint: string | null;
          idx: number | null;
          created_at: string | null;
        }>;
      }>;
      dynamic_rubric?: {
        chat_id: string;
        score: number;
        total_possible_points: number;
        passed: boolean;
      } | null;
      grading_state?: {
        achieved_standards: Array<{
          standard_id: string | null;
          achieved: boolean | null;
        }> | null;
        passed_standards: Array<{
          standard_id: string | null;
          passed: boolean | null;
        }> | null;
        grade_description: string | null;
        feedback_by_standard_id: Array<{
          standard_id: string | null;
          feedback: string | null;
        }> | null;
      } | null;
      video?: {
        id: string;
        upload_id: string | null;
        questions?: Array<{
          id: string;
          question_text: string;
          type: string;
          allow_multiple: boolean | null;
          times: Array<number> | null;
          options: Array<{
            id: string;
            option_text: string;
            type: string | null;
            is_correct: boolean | null;
          }> | null;
        }>;
      } | null;
    }>;
    scenario_documents?: Array<{
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
    rubric_structure?: {
      standard_groups: Array<{
        standard_group_id: string | null;
        standard_ids: Array<string> | null;
      }>;
      standard_groups_mapping: Array<{
        standard_group_id: string | null;
        name: string | null;
        description: string | null;
        points: number | null;
        pass_points: number | null;
      }>;
      standards_mapping: Array<{
        standard_id: string | null;
        name: string | null;
        description: string | null;
        points: number | null;
      }>;
    } | null;
    current_chat_index?: number;
    expected_chat_count?: number;
    is_single_chat_attempt?: boolean;
    timer?: {
      elapsed: number;
      limit: number | null;
      exceeded: boolean;
    };
    show_results?: boolean;
    is_active?: boolean;
  };
}

export function AttemptChatSetup({
  attempt_id,
  attempt_data: initialAttemptData,
}: AttemptChatSetupProps) {
  const router = useRouter();
  const { socket, isConnected } = useProfile();

  // State management
  const [attemptData, setAttemptData] = useState(initialAttemptData);
  const [currentChatIndex, setCurrentChatIndex] = useState(
    initialAttemptData.current_chat_index ?? 0
  );
  const [showDocuments, setShowDocuments] = useState(true);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [showGrades, setShowGrades] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);

  // Streaming and optimistic state
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map()
  );
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<
      string,
      {
        id: string;
        type: "query" | "response";
        content: string;
        created_at: string;
        completed: boolean;
        persona_id?: string | null;
      }
    >
  >(new Map());

  // Current chat data
  const currentChat = useMemo(() => {
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    const chatData = attemptData.chats[currentChatIndex];
    return chatData?.chat || null;
  }, [attemptData, currentChatIndex]);

  const scenario = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    return chatData?.scenario ?? null;
  }, [attemptData, currentChat]);

  // Determine view mode
  const chatAreaViewMode: ChatAreaViewMode = useMemo(() => {
    if (showGrades) return "rubric";
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    if (currentChatData?.video?.upload_id) return "video";
    // Check if we have grading data
    const hasGradingData =
      currentChatData?.grading_state ||
      currentChatData?.messages?.some(
        (m) => m.feedbacks && m.feedbacks.length > 0
      );
    if (hasGradingData && currentChat?.completed) return "graded-messages";
    return "messages";
  }, [showGrades, attemptData, currentChatIndex, currentChat]);

  // WebSocket handlers
  const handleSendMessage = useCallback(
    async (message: string, _isRetry?: boolean) => {
      if (!message.trim() || !currentChat || isSendingMessage || !socket)
        return;

      setIsSendingMessage(true);
      try {
        socket.emit("member_progress", {
          chat_id: currentChat.id,
          message: message,
          voice_mode: false,
          upload_id: undefined,
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false);
      }
    },
    [currentChat, isSendingMessage, socket]
  );

  const handleStopMessage = useCallback(async () => {
    if (!currentChat || isStoppingMessage || !socket) return;
    setIsStoppingMessage(true);
    try {
      socket.emit("simulation_text_stop", {
        chat_id: currentChat.id,
      });
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChat, isStoppingMessage, socket]);

  // WebSocket event handlers would be set up here
  // (similar to AttemptChat.tsx but simplified)

  // Prepare props for each component
  const chatHeaderProps: ChatHeaderProps = useMemo(() => {
    const timer = attemptData?.timer;
    return {
      timer: timer
        ? {
            elapsed: timer.elapsed ?? 0,
            remaining:
              timer.limit !== null && timer.elapsed !== null
                ? timer.limit - timer.elapsed
                : null,
            expired: timer.exceeded ?? false,
          }
        : undefined,
      show_documents: showDocuments,
      show_objectives: showObjectives,
      show_rubric: showGrades,
      on_toggle_documents: setShowDocuments,
      on_toggle_objectives: setShowObjectives,
      on_toggle_rubric: setShowGrades,
      objectives: scenario?.objectives || [],
      scenario_title: scenario?.problem_statement || scenario?.name || null,
      attempt: attemptData?.attempt || null,
      simulation: attemptData?.simulation || null,
      current_dynamic_rubric:
        attemptData?.chats?.[currentChatIndex]?.dynamic_rubric || null,
      expected_chat_count: attemptData?.expected_chat_count || 1,
      chats:
        attemptData?.chats?.map((c) => ({
          id: c.chat?.id || "",
          completed: c.chat?.completed ?? null,
        })) || [],
      display_chat: currentChat
        ? {
            id: currentChat.id,
            completed: currentChat.completed ?? null,
          }
        : null,
    };
  }, [
    attemptData,
    currentChatIndex,
    currentChat,
    scenario,
    showDocuments,
    showObjectives,
    showGrades,
  ]);

  const chatAreaProps = useMemo(() => {
    const currentChatData = attemptData?.chats?.[currentChatIndex];

    if (chatAreaViewMode === "messages") {
      const props: MessagesViewProps = {
        messages: currentChatData?.messages?.map((m) => ({
          id: m.id,
          type: m.type === "user" ? "query" : "response",
          content: m.content,
          created_at: m.created_at,
          completed: m.completed ?? null,
          persona_id: m.persona_id ?? null,
        })),
        streaming_content: streamingContent,
        optimistic_messages: optimisticMessages,
        personas: currentChatData?.personas || [],
        scenario: scenario
          ? {
              persona_name: scenario.persona_name ?? null,
              persona_icon: scenario.persona_icon ?? null,
              persona_color: scenario.persona_color ?? null,
            }
          : null,
        current_chat: currentChat
          ? {
              id: currentChat.id,
              completed: currentChat.completed ?? null,
            }
          : null,
        current_chat_hints:
          currentChatData?.hints?.map((h) => ({
            message_id: h.message_id || "",
            hints: (h.hints || []).map((hint) => ({
              simulation_message_id: hint.simulation_message_id || "",
              hint: hint.hint || "",
              idx: hint.idx ?? 0,
              created_at: hint.created_at || "",
            })),
          })) || [],
        send_message: handleSendMessage,
        is_sending_message: isSendingMessage,
        is_active: !(attemptData?.timer?.exceeded ?? false),
        simulation: attemptData?.simulation
          ? {
              time_limit: attemptData.simulation.time_limit ?? null,
              practice_simulation:
                attemptData.simulation.practice_simulation ?? null,
            }
          : null,
        background_image: scenario?.background_image ?? null,
        chat_id: currentChat?.id,
        is_attempt_owner: true, // Would be determined from profile context
      };
      return props;
    } else if (chatAreaViewMode === "graded-messages") {
      const props: GradedMessagesViewProps = {
        messages:
          currentChatData?.messages?.map((m) => ({
            id: m.id,
            type: m.type === "user" ? "query" : "response",
            content: m.content,
            created_at: m.created_at,
            completed: m.completed ?? null,
            persona_id: m.persona_id ?? null,
            feedbacks: m.feedbacks,
          })) || [],
        personas: currentChatData?.personas || [],
        scenario: scenario
          ? {
              persona_name: scenario.persona_name ?? null,
              persona_icon: scenario.persona_icon ?? null,
              persona_color: scenario.persona_color ?? null,
            }
          : null,
        grade: { id: "graded" },
      };
      return props;
    } else if (chatAreaViewMode === "video") {
      const props: VideoViewProps = {
        video_data: {
          id: currentChatData?.video?.id || "",
          upload_id: currentChatData?.video?.upload_id ?? null,
        },
        video_questions: currentChatData?.video?.questions,
      };
      return props;
    } else {
      const props: RubricViewProps = {
        rubric_data: {
          standard_groups: attemptData?.rubric_structure?.standard_groups || [],
          standard_groups_mapping:
            attemptData?.rubric_structure?.standard_groups_mapping || [],
          standards_mapping:
            attemptData?.rubric_structure?.standards_mapping || [],
        },
        grading_state: currentChatData?.grading_state,
      };
      return props;
    }
  }, [
    attemptData,
    currentChatIndex,
    currentChat,
    scenario,
    chatAreaViewMode,
    streamingContent,
    optimisticMessages,
    handleSendMessage,
    isSendingMessage,
  ]);

  const documentAreaProps: DocumentAreaProps | undefined = useMemo(() => {
    if (!showDocuments) return undefined;
    return {
      visible: showDocuments,
      documents: attemptData?.scenario_documents || [],
      selected_document_id: selectedDocumentId,
      on_select_document: setSelectedDocumentId,
      current_chat: currentChat
        ? {
            document_ids: currentChat.document_ids ?? null,
          }
        : null,
    };
  }, [
    showDocuments,
    attemptData?.scenario_documents,
    selectedDocumentId,
    currentChat,
  ]);

  const inputAreaProps = useMemo(() => {
    // Determine input mode based on scenario settings
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const hasVideoQuestions =
      attemptData?.chats?.[currentChatIndex]?.video?.questions &&
      attemptData.chats[currentChatIndex].video?.questions.length > 0;

    if (hasVideoQuestions) {
      const props: QuestionResponsesInputProps = {
        enabled: !currentChat?.completed ?? true,
        questions: attemptData.chats[currentChatIndex].video?.questions || [],
        selected_answers: new Map(),
        on_answer_change: () => {},
        on_submit: () => {},
      };
      return props;
    } else if (audioEnabled && !textEnabled) {
      const props: VoiceInputProps = {
        enabled: !currentChat?.completed ?? true,
        on_voice_start: async () => {
          if (!currentChat?.id || !socket) return;
          socket.emit("simulation_voice_start", { chat_id: currentChat.id });
        },
        on_voice_stop: async () => {
          if (!currentChat?.id || !socket) return;
          socket.emit("simulation_voice_stop", { chat_id: currentChat.id });
        },
        current_chat: currentChat ? { id: currentChat.id } : null,
        is_connected: isConnected,
      };
      return props;
    } else {
      const props: TextInputProps = {
        enabled: !currentChat?.completed ?? true,
        copy_paste_allowed:
          scenario?.copy_paste_allowed ??
          attemptData?.simulation?.copy_paste_allowed ??
          false,
        on_send_message: handleSendMessage,
        on_stop_message: handleStopMessage,
        is_sending_message: isSendingMessage,
        is_stopping_message: isStoppingMessage,
        is_connected: isConnected,
        current_chat: currentChat
          ? {
              id: currentChat.id,
              completed: currentChat.completed ?? null,
            }
          : null,
        is_attempt_owner: true,
        on_height_change: setInputPanelHeight,
      };
      return props;
    }
  }, [
    scenario,
    attemptData,
    currentChatIndex,
    currentChat,
    isSendingMessage,
    isStoppingMessage,
    isConnected,
    handleSendMessage,
    handleStopMessage,
    socket,
  ]);

  // Determine which components to use
  const ChatAreaComponent = useMemo(() => {
    switch (chatAreaViewMode) {
      case "messages":
        return MessagesView;
      case "graded-messages":
        return GradedMessagesView;
      case "video":
        return VideoView;
      case "rubric":
        return RubricView;
      default:
        return MessagesView;
    }
  }, [chatAreaViewMode]);

  const InputAreaComponent = useMemo(() => {
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const hasVideoQuestions =
      attemptData?.chats?.[currentChatIndex]?.video?.questions &&
      attemptData.chats[currentChatIndex].video?.questions.length > 0;

    if (hasVideoQuestions) {
      return QuestionResponsesInput;
    } else if (audioEnabled && !textEnabled) {
      return VoiceInput;
    } else {
      return TextInput;
    }
  }, [scenario, attemptData, currentChatIndex]);

  return (
    <GenericChatInterface
      chat_header={AttemptChatHeader}
      chat_area={ChatAreaComponent}
      document_area={AttemptDocumentArea}
      input_area={InputAreaComponent}
      chat_area_view_mode={chatAreaViewMode}
      on_send_message={handleSendMessage}
      on_stop_message={handleStopMessage}
      show_documents={showDocuments}
      show_document_modal={showDocumentModal}
      show_objectives_modal={showObjectivesModal}
      input_panel_height={inputPanelHeight}
      chat_header_props={chatHeaderProps}
      chat_area_props={chatAreaProps}
      document_area_props={documentAreaProps}
      input_area_props={inputAreaProps}
    />
  );
}
