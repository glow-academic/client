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
  status?: "success" | "error" | "processing";
}

export async function messageAssistant(
  params: MessageAssistantParams
): Promise<MessageAssistantResponse> {
  try {
    const formData = new FormData();
    formData.append("chat_id", params.chat_id);
    formData.append("message", params.message);

    const response = await fetch(`${getApiUrl()}/assistants/message`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.detail ||
        `Failed to send message to assistant: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Message sent successfully",
      status: result.status || "processing",
    };
  } catch (error) {
    const errorMessage = `Error sending message to assistant: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
