/**
 * Transport abstraction — decouples generation pipeline from protocol.
 *
 * Two orthogonal channels:
 *   CommandChannel — send(endpoint, body) → Promise<response>
 *     Impls: WS (socket.emit + ack/completed events), HTTP (api.post)
 *   EventChannel   — on(event, handler) → unsubscribe
 *     Impls: WS (socket.on), SSE (EventSource multiplexer)
 *
 * Four modes compose these 2×2:
 *   "ws"       — WS commands  + WS events
 *   "http-ws"  — HTTP commands + WS events
 *   "http-sse" — HTTP commands + SSE events
 *   "ws-sse"   — WS commands   + SSE events
 *
 * Consumers use `transport.send(...)` / `transport.on(...)` and don't
 * need to know which channels are in play. The Transport type exposes
 * both the flat send/on (back-compat) and the underlying `commands` /
 * `events` channels for advanced use.
 */

export type TransportMode = "ws" | "http-ws" | "http-sse" | "ws-sse";

export type EventHandler = (data: Record<string, unknown>) => void;

export interface CommandChannel {
  send(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export interface EventChannel {
  on(event: string, handler: EventHandler): () => void;
}

export interface Transport {
  /** Current mode identifier. */
  mode: TransportMode;
  /** Underlying command channel (commands / writes). */
  commands: CommandChannel;
  /** Underlying event channel (events / reads). */
  events: EventChannel;
  /** Back-compat delegate to `commands.send`. */
  send: CommandChannel["send"];
  /** Back-compat delegate to `events.on`. */
  on: EventChannel["on"];
}
