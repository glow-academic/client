/**
 * start-assistant.ts
 * Used to start an assistant.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface StartAssistantParams {
    initial_message: string;
    chat_id: string;
}

export interface StartAssistantResponse {
    success: boolean;
    message: string;
}

export async function startAssistant(params: StartAssistantParams): Promise<StartAssistantResponse> {
    try {
        const formData = new FormData();
        formData.append("initial_message", params.initial_message);
        formData.append("chat_id", params.chat_id);

        const response = await fetch(`${getApiUrl()}/assistants/start`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        logError(`Error starting assistant: ${error}`);
        throw error;
    }
}