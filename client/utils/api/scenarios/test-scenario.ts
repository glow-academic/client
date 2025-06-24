/**
 * test-scenario.ts
 * Used to test a scenario.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

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
  params: TestScenarioParams
): Promise<TestScenarioResponse> {
  try {
    const formData = new FormData();
    formData.append("agent_id", params.agentId);
    if (params.description) {
      formData.append("description", params.description);
    }
    formData.append("query", params.query);

    const response = await fetch(`${getApiUrl()}/scenarios/test`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to test scenario: ${response.status} ${response.statusText}`;
      logError(errorMessage);
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
      logError(errorMessage);
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
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
