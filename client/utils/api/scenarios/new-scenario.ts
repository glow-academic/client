/**
 * new-scenario.ts
 * Used to create a new scenario.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface NewScenarioParams {
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
  profileId?: string | null;
}

export interface NewScenarioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  title?: string;
  description?: string;
}

export async function newScenario(
  params: NewScenarioParams,
): Promise<NewScenarioResponse> {
  try {
    const formData = new FormData();

    // Only append non-null values
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
    const response = await fetch(`${getApiBase()}/scenarios/new`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to generate new scenario: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: result.success || true,
      message: result.message || "Scenario generated successfully",
      status: result.status || "success",
      title: result.title,
      description: result.description,
    };
  } catch (error) {
    const errorMessage = `Error generating new scenario: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
