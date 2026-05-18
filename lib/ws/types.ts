/**
 * Socket event types extracted from OpenAPI schema using type introspection.
 * This file uses InputOf/OutputOf helpers to extract types directly from the OpenAPI schema.
 * Types update automatically when the OpenAPI schema changes.
 *
 * All socket types come from v5 OpenAPI routes.
 */

import type { InputOf, PathKey } from "@/lib/api/types";

// Extract all socket paths (v5 only)
type SocketPath = Extract<PathKey, `/socket/v5/${string}`>;

// Extract client-to-server paths
type ClientToServerPath = Extract<SocketPath, `/socket/v5/client/${string}`>;

// Extract server-to-client paths
type ServerToClientPath = Extract<SocketPath, `/socket/v5/server/${string}`>;

// Helper to collapse slashes to underscores: "simulation/text/start" → "simulation_text_start"
type CollapseSlashes<S extends string> = S extends `${infer A}/${infer B}`
  ? `${A}_${CollapseSlashes<B>}`
  : S;

// Extract event name from path by removing prefix and collapsing slashes
// "/socket/v5/client/attempt/start" → "attempt_start"
// "/socket/v5/server/attempt/started" → "attempt_started"
// "/socket/v5/server/names_generation_complete" → "names_generation_complete"
type EventName<P extends SocketPath> = P extends `/socket/v5/client/${infer E}`
  ? CollapseSlashes<E>
  : P extends `/socket/v5/server/${infer E}`
    ? CollapseSlashes<E>
    : never;

// Helper to get payload type from InputOf (for client-to-server events)
// InputOf returns an object with optional fields, so we extract the body field
type SocketInputPayload<P extends SocketPath> =
  InputOf<P, "post"> extends {
    body: infer B;
  }
    ? B
    : never;

// Helper to get payload type from requestBody (for server-to-client events)
// Socket.IO server-to-client events send payload in requestBody, not response
// The response is just a confirmation { [key: string]: boolean }
type SocketOutputPayload<P extends SocketPath> =
  InputOf<P, "post"> extends {
    body: infer B;
  }
    ? B
    : never;

// Note: The OpenAPI paths use /socket/v5/client/ for client-to-server events
// and /socket/v5/server/ for server-to-client events, so we can use the path
// prefix to determine direction instead of relying on naming patterns.

// Build ServerToClientEvents type
export type ServerToClientEvents = {
  [K in ServerToClientPath as EventName<K>]: (
    payload: SocketOutputPayload<K>,
  ) => void;
};

// Build ClientToServerEvents type
export type ClientToServerEvents = {
  [K in ClientToServerPath as EventName<K>]: (
    payload: SocketInputPayload<K>,
  ) => void;
};
