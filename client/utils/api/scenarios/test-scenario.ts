/**
 * test-scenario.ts
 * Used to test a scenario.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface TestScenarioParams {
  agentId: string;
  description?: string;
  query: string;
}

export interface TestScenarioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  response?: Response;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
}

export async function testScenario(
  params: TestScenarioParams,
): Promise<TestScenarioResponse> {
  try {
    const formData = new FormData();
    formData.append("agent_id", params.agentId);
    if (params.description) {
      formData.append("description", params.description);
    }
    formData.append("query", params.query);

    const response = await fetch(`${getApiBase()}/scenarios/test`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to test scenario: ${response.status} ${response.statusText}`;
      log.error("scenario.test.failed", {
        message: errorMessage,
        context: { function: "testScenario" },
      });
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    // For streaming responses, return the response object and reader
    const reader = response.body?.getReader();
    if (!reader) {
      const errorMessage = "No response body available for streaming";
      log.error("scenario.test.reader_missing", {
        message: errorMessage,
        context: { function: "testScenario" },
      });
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    return {
      success: true,
      message: "Scenario test started successfully",
      status: "success",
      response,
      reader,
    };
  } catch (error) {
    const errorMessage = `Error testing scenario: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.error("scenario.test.error", {
      message: errorMessage,
      error,
      context: { function: "testScenario" },
    });
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
