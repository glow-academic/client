/**
 * app/api/v2/scenarios/randomize/route.ts
 * BFF route for scenario randomization
 * Proxies requests to FastAPI backend
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { log } from "@/lib/api/v2/server/logs";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await log.info("scenarios.randomize.start", {
      message: "Randomizing scenario sections",
      subject: { entityType: "scenario" },
      context: {
        function: "POST",
        file: "app/api/v2/scenarios/randomize/route.ts",
      },
    });

    const response = await fetch(`${getApiBase()}/api/v2/scenarios/randomize`, {
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

    if (!response.ok) {
      await log.error("scenarios.randomize.failed", {
        message: `Randomization failed: ${response.status}`,
        subject: { entityType: "scenario" },
        context: {
          function: "POST",
          file: "app/api/v2/scenarios/randomize/route.ts",
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
    await log.error("scenarios.randomize.error", {
      message: "Randomization error",
      subject: { entityType: "scenario" },
      context: {
        function: "POST",
        file: "app/api/v2/scenarios/randomize/route.ts",
      },
      error,
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: "Error randomizing scenario",
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
