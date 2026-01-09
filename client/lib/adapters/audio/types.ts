/**
 * Audio adapter types matching backend AudioSessionConfig and event types.
 * These types ensure type safety between frontend and backend.
 */

/**
 * Audio session configuration matching backend AudioSessionConfig Pydantic model.
 */
export type AudioSessionConfig = {
  type: "webrtc" | "websocket";
  run_id: string;
  // WebRTC-specific fields (OpenAI)
  ephemeral_key?: string | null;
  expires_in?: number | null;
  model?: string | null;
  tools?: Array<Record<string, unknown>> | null;
  instructions?: string | null;
  history?: Array<Record<string, unknown>> | null;
  voice?: string | null;
  transcription_model?: string | null;
  transcription_prompt?: string | null;
  // WebSocket-specific fields (future Gemini)
  websocket_url?: string | null;
  auth_token?: string | null;
};

/**
 * All 14 standardized audio event types matching backend AUDIO_EVENT_TYPES.
 */
export type AudioEventType =
  // User events
  | "audio_user_start"
  | "audio_user_progress"
  | "audio_user_complete"
  // Assistant events
  | "audio_assistant_start"
  | "audio_assistant_progress"
  | "audio_assistant_complete"
  // Tool call events
  | "audio_tool_call_start"
  | "audio_tool_call_progress"
  | "audio_tool_call_complete"
  // Audio linking events
  | "audio_user_audio_link"
  | "audio_assistant_audio_link"
  // Session events
  | "audio_session_usage"
  | "audio_session_interrupt"
  // Error events
  | "audio_error";

/**
 * Event payload types for each event type.
 */
export type AudioUserStartPayload = {
  item_id: string;
  audio_start_ms?: number;
  chat_id?: string;
  run_id: string;
};

export type AudioUserProgressPayload = {
  item_id: string;
  delta: string;
  chat_id?: string;
  run_id: string;
};

export type AudioUserCompletePayload = {
  item_id: string;
  transcript: string;
  upload_id?: string;
  chat_id?: string;
  run_id: string;
};

export type AudioAssistantStartPayload = {
  call_id: string;
  item_id: string;
  chat_id?: string;
  run_id: string;
};

export type AudioAssistantProgressPayload = {
  call_id: string;
  item_id: string;
  delta: string;
  chat_id?: string;
  run_id: string;
};

export type AudioAssistantCompletePayload = {
  call_id: string;
  item_id: string;
  arguments: string;
  upload_id?: string;
  chat_id?: string;
  run_id: string;
};

export type AudioToolCallStartPayload = {
  call_id: string;
  tool_name: string;
  chat_id?: string;
  run_id: string;
};

export type AudioToolCallProgressPayload = {
  call_id: string;
  tool_name: string;
  delta: string;
  chat_id?: string;
  run_id: string;
};

export type AudioToolCallCompletePayload = {
  call_id: string;
  tool_name: string;
  arguments: string;
  chat_id?: string;
  run_id: string;
};

export type AudioUserAudioLinkPayload = {
  upload_id: string;
  item_id: string;
  message_id: string;
  chat_id?: string;
  run_id: string;
};

export type AudioAssistantAudioLinkPayload = {
  upload_id: string;
  call_id: string;
  message_id: string;
  chat_id?: string;
  run_id: string;
};

export type AudioSessionUsagePayload = {
  run_id: string;
  input_tokens?: number;
  output_tokens?: number;
  input_audio_ms?: number;
  output_audio_ms?: number;
  [key: string]: unknown;
};

export type AudioSessionInterruptPayload = {
  run_id: string;
  reason?: string;
  chat_id?: string;
};

export type AudioErrorPayload = {
  run_id: string;
  error_message: string;
  context?: Record<string, unknown>;
  chat_id?: string;
};

/**
 * Union type of all event payloads.
 */
export type AudioEventPayload =
  | AudioUserStartPayload
  | AudioUserProgressPayload
  | AudioUserCompletePayload
  | AudioAssistantStartPayload
  | AudioAssistantProgressPayload
  | AudioAssistantCompletePayload
  | AudioToolCallStartPayload
  | AudioToolCallProgressPayload
  | AudioToolCallCompletePayload
  | AudioUserAudioLinkPayload
  | AudioAssistantAudioLinkPayload
  | AudioSessionUsagePayload
  | AudioSessionInterruptPayload
  | AudioErrorPayload;

/**
 * Event emitter callback function type.
 * Used by adapters to emit events to backend via Socket.IO.
 */
export type AudioEventEmitter = (
  eventType: AudioEventType,
  payload: Record<string, unknown>
) => void;

/**
 * Event handler function type.
 * Used by components to subscribe to adapter events.
 */
export type AudioEventHandler = (payload: unknown) => void;
