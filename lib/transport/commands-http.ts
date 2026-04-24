/**
 * HTTP command channel — commands go through the typed api client
 * (Next.js server actions / fetch). Used by http-ws and http-sse modes.
 */
import { api } from "@/lib/api/client";
import type { CommandChannel } from "./types";

export function createHttpCommands(): CommandChannel {
  return {
    async send(endpoint, body) {
      return api.post(endpoint as Parameters<typeof api.post>[0], {
        body,
      }) as Promise<Record<string, unknown>>;
    },
  };
}
