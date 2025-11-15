import { INTERNAL_WS_BASE, SOCKET_PATH } from "@/lib/api/config";
import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./types";

type QueryValue = string | number | boolean | undefined;
export type SocketQuery = Record<string, QueryValue>;

/** Browser sockets typically go direct to backend; swap to BFF if you proxy WS. */
export function createSocketClient(
  query: SocketQuery
): Socket<ServerToClientEvents, ClientToServerEvents> {
  const base = INTERNAL_WS_BASE;
  const opts: Partial<ManagerOptions & SocketOptions> = {
    path: SOCKET_PATH,
    transports: ["websocket"],
    upgrade: false,
    withCredentials: true,
    query,
    timeout: 30000,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 8000,
  };
  return io(base || undefined, opts) as Socket<
    ServerToClientEvents,
    ClientToServerEvents
  >;
}