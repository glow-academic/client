/**
 * message-assistant.ts
 * Used to send a message to an assistant.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface MessageAssistantParams {
    chat_id: string;
    message: string;
}

export interface MessageAssistantResponse {
    success: boolean;
    message: string;
}

export async function messageAssistant(params: MessageAssistantParams): Promise<MessageAssistantResponse> {
    try {
        const formData = new FormData();
        formData.append("chat_id", params.chat_id);
        formData.append("message", params.message);

        const response = await fetch(`${getApiUrl()}/assistants/message`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        logError(`Error sending message to assistant: ${error}`);
        throw error;
    }
}