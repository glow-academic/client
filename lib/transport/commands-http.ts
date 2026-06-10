/**
 * HTTP command channel — the browser-side fallback command path used when
 * the WebSocket is not connected (`http-ws` / `http-sse` modes).
 *
 * CLIENT/SERVER BOUNDARY (#108): this runs in the browser, so it must NOT
 * import the SERVER-ONLY api (`lib/api/client.ts`), which pulls
 * `next/headers` / the session bearer into the bundle. It calls the
 * client-safe transport (`request-core.ts`) directly. As before, the
 * browser sends NO `Authorization` bearer (it never holds one — #103); the
 * request is authenticated by the same-origin httpOnly session cookie.
 */
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { doRequest } from "@/lib/api/request-core";
import type { CommandChannel } from "./types";

export function createHttpCommands(): CommandChannel {
  return {
    async send(endpoint, body) {
      return doRequest<Record<string, unknown>>(
        INTERNAL_HTTP_BASE,
        "POST",
        endpoint,
        { body },
      );
    },
  };
}
