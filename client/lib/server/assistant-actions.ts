"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type AssistantChatListIn = InputOf<"/api/v3/assistant/chats/list", "post">;
type AssistantChatListOut = OutputOf<"/api/v3/assistant/chats/list", "post">;

type AssistantChatFullIn = InputOf<"/api/v3/assistant/chats/full", "post">;
type AssistantChatFullOut = OutputOf<"/api/v3/assistant/chats/full", "post">;

export async function getAssistantChatList(
  input: AssistantChatListIn
): Promise<AssistantChatListOut> {
  return api.post("/assistant/chats/list", input);
}

export async function getAssistantChatFull(
  input: AssistantChatFullIn
): Promise<AssistantChatFullOut> {
  return api.post("/assistant/chats/full", input);
}
