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
  agentId?: string | null;
  classId?: string | null;
  documentIds?: string[];
  crowdedness?: number | null;
  intensity?: number | null;
  seniority?: string | null;
  location?: string | null;
  tod?: string | null;
  urgency?: string | null;
}

export interface NewScenarioResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  title?: string;
  description?: string;
}

export async function newScenario(
  params: NewScenarioParams
): Promise<NewScenarioResponse> {
  try {
    const formData = new FormData();

    // Only append non-null values
    if (params.agentId) {
      formData.append("agent_id", params.agentId);
    }
    if (params.classId) {
      formData.append("class_id", params.classId);
    }
    if (params.documentIds && params.documentIds.length > 0) {
      params.documentIds.forEach((docId) => {
        if (docId) {
          formData.append("document_ids", docId);
        }
      });
    }
    if (params.seniority) {
      formData.append("seniority", params.seniority);
    }
    if (params.crowdedness !== null && params.crowdedness !== undefined) {
      formData.append("crowdedness", params.crowdedness.toString());
    }
    if (params.intensity !== null && params.intensity !== undefined) {
      formData.append("intensity", params.intensity.toString());
    }
    if (params.location) {
      formData.append("location", params.location);
    }
    if (params.tod) {
      formData.append("tod", params.tod);
    }
    if (params.urgency) {
      formData.append("urgency", params.urgency);
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
