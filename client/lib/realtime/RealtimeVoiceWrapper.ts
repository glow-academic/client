/**
 * RealtimeVoiceWrapper.ts
 * Thin wrapper around OpenAI Realtime API that forwards events to server.
 * All logic is handled server-side - this is just a pass-through.
 */

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/ws/types";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import type { Socket } from "socket.io-client";

export interface RealtimeVoiceWrapperOptions {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  chatId: string;
  ephemeralKey: string;
}

export class RealtimeVoiceWrapper {
  private session: RealtimeSession | null = null;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private chatId: string;
  private ephemeralKey: string;
  private isConnected = false;

  constructor(options: RealtimeVoiceWrapperOptions) {
    this.socket = options.socket;
    this.chatId = options.chatId;
    this.ephemeralKey = options.ephemeralKey;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create Realtime agent
      const agent = new RealtimeAgent({
        name: "Voice Assistant",
        instructions: "You are a helpful voice assistant.",
      });

      // Create Realtime session
      this.session = new RealtimeSession(agent, {
        model: "gpt-realtime",
      });

      // Connect with ephemeral key
      await this.session.connect({ apiKey: this.ephemeralKey });

      // Set up event listeners to forward to server
      this.setupEventForwarding();

      this.isConnected = true;
    } catch (error) {
      console.error("Failed to connect Realtime session:", error);
      throw error;
    }
  }

  private setupEventForwarding(): void {
    if (!this.session) {
      return;
    }

    // Forward all realtime events to server via WebSocket
    // The OpenAI Realtime API emits various events that we forward to the server
    // The server will process these and handle tool calls

    // The RealtimeSession from @openai/agents/realtime emits events
    // We need to listen to the underlying WebSocket events and forward them
    // The exact API may vary, but we'll forward key events

    // Listen for any events from the session and forward them
    // The session should have an event emitter interface
    if (this.session && typeof (this.session as any).on === "function") {
      // Forward function call events (when tool is called)
      (this.session as any).on("function_call", (data: any) => {
        this.socket.emit("voice_realtime_event", {
          chat_id: this.chatId,
          event_type: "response.function_call",
          event_data: data as Record<string, unknown>,
        });
      });

      // Forward function call arguments when complete (this is when we get the tool call with arguments)
      (this.session as any).on("function_call_arguments_done", (data: any) => {
        this.socket.emit("voice_realtime_event", {
          chat_id: this.chatId,
          event_type: "response.function_call_arguments.done",
          event_data: data as Record<string, unknown>,
        });
      });

      // Forward generic events
      (this.session as any).on("event", (event: any) => {
        this.socket.emit("voice_realtime_event", {
          chat_id: this.chatId,
          event_type: event.type || "unknown",
          event_data: (event.data || event) as Record<string, unknown>,
        });
      });
    }

    // Handle server responses (for audio playback, etc.)
    // This will be implemented when server sends audio chunks
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.disconnect();
      this.session = null;
    }
    this.isConnected = false;
  }

  // Method to append audio input (called from browser microphone)
  appendInputAudio(audio: ArrayBuffer): void {
    if (!this.session || !this.isConnected) {
      return;
    }

    // Append audio to Realtime session
    // This will trigger events that get forwarded to server
    this.session.inputAudioBuffer.append(audio);
  }

  // Method to handle server audio output (for playback)
  handleAudioOutput(audio: ArrayBuffer): void {
    // Play audio through browser audio context
    // This will be called when server sends audio chunks
  }
}
