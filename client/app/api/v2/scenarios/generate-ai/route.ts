/**
 * app/api/v2/scenarios/generate-ai/route.ts
 * BFF route for AI scenario generation
 * Proxies requests to FastAPI backend
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/lib/api/v2/server/logs";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await log.info("scenarios.generate-ai.start", {
      message: "Generating AI scenario content",
      subject: { entityType: "scenario" },
      context: {
        function: "POST",
        file: "app/api/v2/scenarios/generate-ai/route.ts",
      },
    });

    const response = await fetch(
      `${getApiBase()}/api/v2/scenarios/generate-ai`,
      {
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      await log.error("scenarios.generate-ai.failed", {
        message: `AI generation failed: ${response.status}`,
        subject: { entityType: "scenario" },
        context: {
          function: "POST",
          file: "app/api/v2/scenarios/generate-ai/route.ts",
          status: response.status,
        },
      });
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    await log.error("scenarios.generate-ai.error", {
      message: "AI generation error",
      subject: { entityType: "scenario" },
      context: {
        function: "POST",
        file: "app/api/v2/scenarios/generate-ai/route.ts",
      },
      error,
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: "Error generating AI content",
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
