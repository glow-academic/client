/**
 * Transport abstraction — decouples generation pipeline from protocol.
 *
 * Two axes:
 *   Commands: HTTP (server actions) | WebSocket (socket.emit)
 *   Events:   WebSocket (socket.on) | SSE (EventSource)
 *
 * Four modes:
 *   "ws"      — WebSocket commands + WebSocket events (power mode, default)
 *   "http-ws" — HTTP commands + WebSocket events
 *   "http-sse"— HTTP commands + SSE events (enterprise, no WebSocket)
 *   "ws-sse"  — WebSocket commands + SSE events (unlikely, but supported)
 */

export type TransportMode = "ws" | "http-ws" | "http-sse" | "ws-sse";

export interface Transport {
  /** Send a command to an endpoint and get a typed response. */
  send(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Subscribe to a namespaced event. Returns an unsubscribe function. */
  on(event: string, handler: (data: Record<string, unknown>) => void): () => void;
  /** Current mode identifier. */
  mode: TransportMode;
}
