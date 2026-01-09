/**
 * Base audio adapter interface matching backend pattern.
 * All audio adapters (OpenAI, Gemini, etc.) must implement this interface.
 */

import type {
  AudioEventHandler,
  AudioEventType,
  AudioSessionConfig,
} from "./types";

/**
 * Base interface for all audio adapters.
 * Matches the backend BaseAudioAdapter pattern.
 */
export interface BaseAudioAdapter {
  /**
   * Returns the implementation type (WebRTC or WebSocket).
   * Matches backend get_implementation_type() method.
   */
  getImplementationType(): "webrtc" | "websocket";

  /**
   * Initialize audio session with configuration from backend.
   * Matches backend initialize_session() method.
   *
   * @param config - AudioSessionConfig from backend
   * @returns Promise that resolves when session is initialized
   */
  initializeSession(config: AudioSessionConfig): Promise<void>;

  /**
   * Subscribe to an audio event.
   * Components can listen to adapter events using this method.
   *
   * @param eventType - The event type to listen for
   * @param handler - Callback function to handle the event
   */
  on(eventType: AudioEventType, handler: AudioEventHandler): void;

  /**
   * Unsubscribe from an audio event.
   *
   * @param eventType - The event type to unsubscribe from
   * @param handler - The handler function to remove
   */
  off(eventType: AudioEventType, handler: AudioEventHandler): void;

  /**
   * Emit an audio event.
   * Adapters use this internally to emit events to subscribers.
   * Events are also forwarded to backend via the event emitter callback.
   *
   * @param eventType - The event type
   * @param payload - Event payload data
   */
  emit(eventType: AudioEventType, payload: Record<string, unknown>): void;

  /**
   * Disconnect the audio session and cleanup resources.
   *
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Check if the adapter is currently connected.
   *
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean;
}
