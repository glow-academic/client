/**
 * randomize-scenario.ts
 * Fetch randomized scenario sections (persona/documents/parameters) from server.
 * @AshokSaravanan222 & @siladiea
 * 08/12/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface RandomizeScenarioParams {
  name?: string | null;
  description?: string | null;
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
  targets?: Array<"persona" | "documents" | "parameters">;
}

export interface RandomizeScenarioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  personaId?: string | null;
  documentIds?: string[];
  parameterItemIds?: string[];
}

export async function randomizeScenario(
  params: RandomizeScenarioParams
): Promise<RandomizeScenarioResponse> {
  try {
    const formData = new FormData();

    if (params.name) formData.append("name", params.name);
    if (params.description) formData.append("description", params.description);
    if (params.personaId) formData.append("persona_id", params.personaId);
    (params.documentIds || []).forEach(
      (id) => id && formData.append("document_ids", id)
    );
    (params.parameterItemIds || []).forEach(
      (id) => id && formData.append("parameter_item_ids", id)
    );
    (params.targets || []).forEach((t) => t && formData.append("targets", t));

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
    } as RandomizeScenarioResponse;
  } catch (error) {
    const errorMessage = `Error randomizing scenario: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return { success: false, message: errorMessage, status: "error" };
  }
}
