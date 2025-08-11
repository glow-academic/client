/**
 * randomize.ts
 * Suggest random persona/documents/parameters based on current inputs.
 * Mirrors style of new-scenario.ts
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface RandomizeParams {
  name?: string | null;
  description?: string | null;
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
  targets: Array<"persona" | "documents" | "parameters">;
}

export interface RandomizeResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
}

export async function randomizeScenario(
  params: RandomizeParams
): Promise<RandomizeResponse> {
  try {
    const formData = new FormData();

    if (params.name) formData.append("name", params.name);
    if (params.description) formData.append("description", params.description);
    if (params.personaId) formData.append("persona_id", params.personaId);

    if (params.documentIds && params.documentIds.length > 0) {
      params.documentIds.forEach(
        (id) => id && formData.append("document_ids", id)
      );
    }
    if (params.parameterItemIds && params.parameterItemIds.length > 0) {
      params.parameterItemIds.forEach(
        (id) => id && formData.append("parameter_item_ids", id)
      );
    }
    if (params.targets && params.targets.length > 0) {
      params.targets.forEach((t) => t && formData.append("targets", t));
    }

    const response = await fetch(`${getApiBase()}/scenarios/randomize`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to randomize scenario: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return { success: false, message: errorMessage, status: "error" };
    }

    const result = await response.json();
    return {
      success: result.success || true,
      message: result.message || "Randomization suggestions generated",
      status: result.status || "success",
      personaId: result.personaId ?? null,
      documentIds: result.documentIds ?? [],
      parameterItemIds: result.parameterItemIds ?? [],
    };
  } catch (error) {
    const errorMessage = `Error randomizing scenario: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    logError(errorMessage, error);
    return { success: false, message: errorMessage, status: "error" };
  }
}
