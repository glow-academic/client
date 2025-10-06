/**
 * create-practice-scenario.ts
 * Create a practice scenario with all attributes filled using server-side logic.
 * @AshokSaravanan222 & @siladiea
 * 08/18/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface CreatePracticeScenarioParams {
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
  profileId?: string | null;
}

export interface CreatePracticeScenarioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  scenario?: {
    id: string;
    name: string;
    description: string;
    personaId: string | null;
    documentIds: string[];
    parameterItemIds: string[];
  };
}

export async function createPracticeScenario(
  params: CreatePracticeScenarioParams,
): Promise<CreatePracticeScenarioResponse> {
  try {
    const formData = new FormData();

    if (params.personaId) {
      formData.append("persona_id", params.personaId);
    }
    if (params.documentIds && params.documentIds.length > 0) {
      params.documentIds.forEach((docId) => {
        if (docId) {
          formData.append("document_ids", docId);
        }
      });
    }
    if (params.parameterItemIds && params.parameterItemIds.length > 0) {
      params.parameterItemIds.forEach((paramId) => {
        if (paramId) {
          formData.append("parameter_item_ids", paramId);
        }
      });
    }
    if (params.profileId) {
      formData.append("profile_id", params.profileId);
    }

    const response = await fetch(`${getApiBase()}/scenarios/practice`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to create practice scenario: ${response.status} ${response.statusText}`;
      log.error("scenario.practice.create.failed", {
        message: errorMessage,
        context: { function: "createPracticeScenario" },
      });
      return { success: false, message: errorMessage, status: "error" };
    }

    const result = await response.json();
    return {
      success: result.success || true,
      message: result.message || "Practice scenario created successfully",
      status: result.status || "success",
      scenario: result.scenario,
    };
  } catch (error) {
    const errorMessage = `Error creating practice scenario: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    log.error("scenario.practice.create.error", {
      message: errorMessage,
      error,
      context: { function: "createPracticeScenario" },
    });
    return { success: false, message: errorMessage, status: "error" };
  }
}
