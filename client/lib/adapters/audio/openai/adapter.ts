/**
 * OpenAI audio adapter - WebRTC implementation.
 * Wraps OpenAI Realtime SDK and maps events to standardized 14 event types.
 */

import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
  type RealtimeSessionConfig,
} from "@openai/agents/realtime";
import * as tus from "tus-js-client";
import type { BaseAudioAdapter } from "../base";
import type {
  AudioEventEmitter,
  AudioEventHandler,
  AudioEventType,
  AudioSessionConfig,
} from "../types";

/**
 * Configuration for OpenAI adapter initialization.
 */
export interface OpenAIAudioAdapterConfig {
  /** AudioSessionConfig from backend */
  config: AudioSessionConfig;
  /** Event emitter callback to forward events to backend via Socket.IO */
  eventEmitter: AudioEventEmitter;
  /** Chat ID for context */
  chatId?: string;
  /** Tools configuration from backend */
  tools?: Array<{
    name: string;
    description: string;
    parameters: string; // JSON string
  }>;
  /** Tool context map for persona tools */
  toolContextMap?: Record<string, unknown>;
}

/**
 * OpenAI audio adapter implementing BaseAudioAdapter.
 * Handles WebRTC connection via OpenAI Realtime SDK.
 */
export class OpenAIAudioAdapter implements BaseAudioAdapter {
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent | null = null;
  private transport: OpenAIRealtimeWebRTC | null = null;
  private eventHandlers: Map<AudioEventType, Set<AudioEventHandler>> =
    new Map();
  private eventEmitter: AudioEventEmitter;
  private config: AudioSessionConfig;
  private chatId: string | undefined;
  private toolContextMap: Record<string, unknown> | undefined;
  private connected = false;

  // Audio recording refs
  private userMediaStream: MediaStream | null = null;
  private userRecorder: MediaRecorder | null = null;
  private userAudioChunks: Blob[] = [];
  private assistantAudioElement: HTMLAudioElement | null = null;
  private assistantRecorder: MediaRecorder | null = null;
  private assistantAudioChunks: Blob[] = [];
  private audioUploadIdMap: Map<string, string> = new Map();
  private pendingAudioUploads: Map<string, string> = new Map();
  private lastCallId: string | null = null;
  private processedItemIds: Set<string> = new Set();

  constructor(config: OpenAIAudioAdapterConfig) {
    this.config = config.config;
    this.eventEmitter = config.eventEmitter;
    this.chatId = config.chatId;
    // toolContextMap kept for future use (stored but not yet used)
    this.toolContextMap = config.toolContextMap || {};
  }

  getImplementationType(): "webrtc" | "websocket" {
    return "webrtc";
  }

  async initializeSession(config: AudioSessionConfig): Promise<void> {
    if (this.connected) {
      throw new Error("Session already initialized");
    }

    this.config = config;

    if (!config.ephemeral_key) {
      throw new Error("ephemeral_key is required for OpenAI WebRTC");
    }

    // Create RealtimeAgent with tools
    const realtimeTools = this.buildRealtimeTools();
    const agent = new RealtimeAgent({
      name: "Voice Agent",
      instructions: config.instructions || "You are a voice agent.",
      tools: realtimeTools,
    });
    this.agent = agent;
    // agent stored for future use

    // Build session config
    const outputModalities: ("text" | "audio")[] = ["audio"];
    const sessionConfig: Partial<RealtimeSessionConfig> = {
      model: config.model ?? "gpt-realtime-mini",
      ...(config.instructions ? { instructions: config.instructions } : {}),
      outputModalities,
      audio: {
        input: {
          format: "pcm16",
          ...(config.transcription_model
            ? {
                transcription: {
                  model: config.transcription_model,
                  ...(config.transcription_prompt
                    ? { prompt: config.transcription_prompt }
                    : {}),
                },
              }
            : {}),
        },
        output: {
          format: "pcm16",
          ...(config.voice ? { voice: config.voice } : {}),
        },
      },
    };

    // Create audio element for assistant audio capture
    const assistantAudioEl = document.createElement("audio");
    assistantAudioEl.autoplay = true;
    assistantAudioEl.setAttribute("playsinline", "true");
    assistantAudioEl.style.display = "none";
    document.body.appendChild(assistantAudioEl);
    this.assistantAudioElement = assistantAudioEl;

    // Get user media stream
    try {
      this.userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch {
      throw new Error("Failed to get microphone access");
    }

    // Create WebRTC transport
    const transport = new OpenAIRealtimeWebRTC({
      mediaStream: this.userMediaStream,
      audioElement: assistantAudioEl,
    });
    this.transport = transport;
    // transport stored for future use

    // Create session
    const session = new RealtimeSession(agent, {
      model: config.model || "gpt-realtime-mini",
      config: sessionConfig,
      transport,
    });
    this.session = session;

    // Set up all event listeners
    this.setupEventListeners(session, transport, assistantAudioEl);

    // Connect session
    await session.connect({ apiKey: config.ephemeral_key });
    this.connected = true;

    // Set up assistant audio capture
    this.setupAssistantAudioCapture(assistantAudioEl);
  }

  private buildRealtimeTools(): never[] {
    // TODO: Get tools from config.tools if available
    // For now, return empty array - tools should come from backend config
    return [];
  }

  private setupEventListeners(
    session: RealtimeSession,
    transport: OpenAIRealtimeWebRTC,
    _assistantAudioEl: HTMLAudioElement
  ) {
    // Map OpenAI SDK events to standardized events

    // User events
    transport.on(
      "input_audio_buffer.speech_started",
      (evt: {
        type: "input_audio_buffer.speech_started";
        event_id: string;
        item_id: string;
        audio_start_ms: number;
      }) => {
        this.emit("audio_user_start", {
          item_id: evt.item_id,
          audio_start_ms: evt.audio_start_ms,
          chat_id: this.chatId,
          run_id: this.config.run_id,
        });
        this.startUserAudioRecording(evt.item_id);
      }
    );

    transport.on(
      "conversation.item.input_audio_transcription.delta",
      (evt: {
        type: "conversation.item.input_audio_transcription.delta";
        delta: string;
        item_id: string;
        content_index: number;
      }) => {
        this.emit("audio_user_progress", {
          item_id: evt.item_id,
          delta: evt.delta,
          chat_id: this.chatId,
          run_id: this.config.run_id,
        });
      }
    );

    transport.on(
      "conversation.item.input_audio_transcription.completed",
      async (evt: {
        type: "conversation.item.input_audio_transcription.completed";
        transcript: string;
        item_id: string;
        content_index: number;
      }) => {
        const transcript = (evt.transcript || "").trim();
        if (!transcript) return;

        const uploadId = this.audioUploadIdMap.get(evt.item_id);
        this.emit("audio_user_complete", {
          item_id: evt.item_id,
          transcript,
          upload_id: uploadId,
          chat_id: this.chatId,
          run_id: this.config.run_id,
        });

        // Clean up upload ID
        if (uploadId) {
          this.audioUploadIdMap.delete(evt.item_id);
        }
      }
    );

    transport.on(
      "input_audio_buffer.speech_stopped",
      async (evt: {
        type: "input_audio_buffer.speech_stopped";
        event_id: string;
        item_id: string;
      }) => {
        await this.stopUserAudioRecording(evt.item_id);
      }
    );

    // Assistant events
    transport.on(
      "response.function_call_arguments.delta",
      (evt: {
        type: "response.function_call_arguments.delta";
        call_id: string;
        item_id: string;
        delta: string;
        response_id: string;
      }) => {
        this.emit("audio_assistant_progress", {
          call_id: evt.call_id,
          item_id: evt.item_id,
          delta: evt.delta,
          chat_id: this.chatId,
          run_id: this.config.run_id,
        });
      }
    );

    transport.on(
      "response.function_call_arguments.done",
      async (evt: {
        type: "response.function_call_arguments.done";
        call_id: string;
        item_id: string;
        arguments: string;
        response_id: string;
      }) => {
        this.lastCallId = evt.call_id;
        await this.handleAssistantAudioComplete(evt.call_id, evt.arguments);
        this.emit("audio_assistant_complete", {
          call_id: evt.call_id,
          item_id: evt.item_id,
          arguments: evt.arguments,
          upload_id: this.pendingAudioUploads.get(evt.call_id),
          chat_id: this.chatId,
          run_id: this.config.run_id,
        });
      }
    );

    // Tool call events
    session.on("agent_tool_start", (_runCtx, _agent, toolDef, _args) => {
      this.emit("audio_tool_call_start", {
        call_id: this.lastCallId || "",
        tool_name: toolDef.name,
        chat_id: this.chatId,
        run_id: this.config.run_id,
      });
    });

    // Note: Tool call progress and complete are handled via assistant events above
    // We can add separate tool call events if needed

    // Session events
    transport.on(
      "response.done",
      (evt: {
        type: "response.done";
        event_id: string;
        response: {
          id: string;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            input_audio_ms?: number;
            output_audio_ms?: number;
          };
        };
      }) => {
        this.emit("audio_session_usage", {
          run_id: this.config.run_id,
          input_tokens: evt.response?.usage?.input_tokens,
          output_tokens: evt.response?.usage?.output_tokens,
          input_audio_ms: evt.response?.usage?.input_audio_ms,
          output_audio_ms: evt.response?.usage?.output_audio_ms,
        });
      }
    );

    session.on("audio_interrupted", () => {
      this.emit("audio_session_interrupt", {
        run_id: this.config.run_id,
        reason: "audio_interrupted",
        chat_id: this.chatId,
      });
      this.stopAssistantAudioRecording();
    });

    // Error events
    session.on("error", (error: unknown) => {
      this.emit("audio_error", {
        run_id: this.config.run_id,
        error_message: error instanceof Error ? error.message : String(error),
        context: { error: String(error) },
        chat_id: this.chatId,
      });
    });

    // History added (for unified user message forwarding)
    session.on("history_added", (item: RealtimeItem) => {
      if (item.type !== "message" || item.role !== "user") return;
      if (this.processedItemIds.has(item.itemId)) return;
      this.processedItemIds.add(item.itemId);

      // Extract text from content array
      const contentArray = item.content as Array<
        | { type: "input_text"; text: string }
        | { type: "input_audio"; transcript: string | null }
      >;

      const textParts: string[] = [];
      for (const c of contentArray || []) {
        if (c.type === "input_text" && typeof c.text === "string") {
          textParts.push(c.text);
        } else if (
          c.type === "input_audio" &&
          typeof c.transcript === "string" &&
          c.transcript.trim().length > 0
        ) {
          textParts.push(c.transcript);
        }
      }

      const finalText = textParts.join(" ").trim();
      if (finalText) {
        // This is handled by the component, not emitted as audio event
        // Component will call member_progress directly
      }
    });
  }

  private setupAssistantAudioCapture(audioEl: HTMLAudioElement) {
    audioEl.addEventListener("playing", () => {
      if (
        this.assistantRecorder &&
        this.assistantRecorder.state === "inactive"
      ) {
        try {
          if (!this.assistantRecorder) {
            const stream =
              (audioEl as any).captureStream?.() ||
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (audioEl as any).mozCaptureStream?.();
            if (stream) {
              this.assistantRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
              });
              this.assistantRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                  this.assistantAudioChunks.push(e.data);
                }
              };
            }
          }
          if (this.assistantRecorder) {
            this.assistantAudioChunks = [];
            this.assistantRecorder.start();
          }
        } catch (err) {
          if (err instanceof Error) {
            // eslint-disable-next-line no-console
            console.error(
              "[OpenAIAudioAdapter] Failed to start assistant recording:",
              err.message
            );
          }
        }
      }
    });
  }

  private async startUserAudioRecording(_itemId: string) {
    try {
      if (!this.userMediaStream) {
        this.userMediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }

      if (!this.userRecorder) {
        this.userRecorder = new MediaRecorder(this.userMediaStream, {
          mimeType: "audio/webm;codecs=opus",
        });
        this.userRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.userAudioChunks.push(e.data);
          }
        };
      }

      this.userAudioChunks = [];
      this.userRecorder.start();
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(
          "[OpenAIAudioAdapter] Failed to start user recording:",
          err.message
        );
      }
    }
  }

  private async stopUserAudioRecording(itemId: string) {
    if (!this.userRecorder || this.userRecorder.state === "inactive") {
      return;
    }

    try {
      this.userRecorder.stop();
      this.userRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.userAudioChunks, {
            type: "audio/webm",
          });
          this.userAudioChunks = [];

          const uploadId = await this.uploadAudio(blob, {
            filename: `user-${itemId}.webm`,
            filetype: "audio/webm",
            role: "user",
          });

          this.audioUploadIdMap.set(itemId, uploadId);
        } catch (err) {
          if (err instanceof Error) {
            // eslint-disable-next-line no-console
            console.error(
              "[OpenAIAudioAdapter] Failed to upload user audio:",
              err.message
            );
          }
        }
      };
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(
          "[OpenAIAudioAdapter] Error stopping user recorder:",
          err.message
        );
      }
    }
  }

  private async handleAssistantAudioComplete(
    callId: string,
    _argumentsStr: string
  ) {
    if (
      !this.assistantRecorder ||
      this.assistantRecorder.state === "inactive"
    ) {
      return;
    }

    try {
      this.assistantRecorder.stop();
      this.assistantRecorder.onstop = async () => {
        try {
          const chunks = [...this.assistantAudioChunks];
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: "audio/webm" });
            this.assistantAudioChunks = [];

            const uploadId = await this.uploadAudio(blob, {
              filename: `assistant-${callId}.webm`,
              filetype: "audio/webm",
              role: "assistant",
            });

            this.pendingAudioUploads.set(callId, uploadId);
          }

          // Restart recording for next tool call
          if (this.assistantRecorder) {
            this.assistantAudioChunks = [];
            this.assistantRecorder.start();
          }
        } catch (err) {
          if (err instanceof Error) {
            // eslint-disable-next-line no-console
            console.error(
              "[OpenAIAudioAdapter] Failed to upload assistant audio:",
              err.message
            );
          }
          if (this.assistantRecorder) {
            this.assistantAudioChunks = [];
            this.assistantRecorder.start();
          }
        }
      };
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error(
          "[OpenAIAudioAdapter] Error stopping assistant recorder:",
          err.message
        );
      }
    }
  }

  private stopAssistantAudioRecording() {
    if (this.assistantRecorder && this.assistantRecorder.state !== "inactive") {
      try {
        this.assistantRecorder.stop();
        this.assistantAudioChunks = [];
      } catch (err) {
        if (err instanceof Error) {
          // eslint-disable-next-line no-console
          console.error(
            "[OpenAIAudioAdapter] Error stopping assistant recorder:",
            err.message
          );
        }
      }
    }
  }

  private async uploadAudio(
    blob: Blob,
    metadata: {
      filename: string;
      filetype: string;
      role: string;
    }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(blob, {
        endpoint: "/api/uploads/tus",
        metadata: {
          filename: metadata.filename,
          filetype: metadata.filetype,
          role: metadata.role,
          subfolder: "audio",
        },
        onSuccess: () => {
          const uploadId = (upload.url?.split("/").pop() || "").split("?")[0];
          if (uploadId) {
            resolve(uploadId);
          } else {
            reject(new Error("Failed to extract upload ID"));
          }
        },
        onError: (error) => {
          reject(error);
        },
      });

      upload.start();
    });
  }

  on(eventType: AudioEventType, handler: AudioEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: AudioEventType, handler: AudioEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(eventType: AudioEventType, payload: Record<string, unknown>): void {
    // Emit to subscribers
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          if (err instanceof Error) {
            // eslint-disable-next-line no-console
            console.error(
              `[OpenAIAudioAdapter] Error in handler for ${eventType}:`,
              err.message
            );
          }
        }
      });
    }

    // Forward to backend via event emitter
    this.eventEmitter(eventType, payload);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // Stop all recording
      if (this.userRecorder && this.userRecorder.state !== "inactive") {
        this.userRecorder.stop();
      }
      this.stopAssistantAudioRecording();

      // Disconnect session
      if (this.session) {
        // RealtimeSession doesn't have a disconnect method, just clear reference
        // The session will be cleaned up when transport is destroyed
        this.session = null;
      }

      // Clean up media streams
      if (this.userMediaStream) {
        this.userMediaStream.getTracks().forEach((track) => track.stop());
        this.userMediaStream = null;
      }

      // Remove audio element
      if (this.assistantAudioElement) {
        document.body.removeChild(this.assistantAudioElement);
        this.assistantAudioElement = null;
      }

      // Clear refs
      this.agent = null;
      this.transport = null;
      this.eventHandlers.clear();
      this.connected = false;
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line no-console
        console.error("[OpenAIAudioAdapter] Error disconnecting:", err.message);
      }
      throw err;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
