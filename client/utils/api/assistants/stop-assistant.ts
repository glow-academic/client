/**
 * stop-assistant.ts
 * Used to stop an assistant.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StopAssistantParams {
    chat_id: string;
}

export interface StopAssistantResponse {
    success: boolean;
    message: string;
}

export async function stopAssistant(params: StopAssistantParams): Promise<StopAssistantResponse> {
    try {
        const formData = new FormData();
        formData.append("chat_id", params.chat_id);

        const response = await fetch(`${getApiUrl()}/assistants/stop`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        logError(`Error stopping assistant: ${error}`);
        throw error;
    }
}