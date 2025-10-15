/**
 * app/api/v2/documents/upload/finalize/route.ts
 *
 * Proxy route for finalizing TUS uploads
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/lib/api/v2/server/logs";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targetUrl = `${getApiBase()}/api/v2/documents/upload/finalize`;

    await log.info("upload.finalize.proxy", {
      message: `POST ${req.url} -> ${targetUrl}`,
      context: {
        function: "POST",
        file: "app/api/v2/documents/upload/finalize/route.ts",
        fileId: body.fileId,
      },
    });

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          [...req.headers.entries()].filter(([key]) =>
            ["authorization", "cookie", "user-agent"].includes(
              key.toLowerCase()
            )
          )
        ),
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    await log.error("upload.finalize.proxy.error", {
      message: "Finalize proxy error",
      context: {
        function: "POST",
        file: "app/api/v2/documents/upload/finalize/route.ts",
      },
      error,
    });
    return new Response(
      JSON.stringify({
        success: false,
        message: "Proxy Error",
        status: "error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/* App-router specific tweaks */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
