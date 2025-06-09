// utils/queries/simulation_messages/get-simulation-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationMessagesByChat(chatId: string) {
  try {
    return await db.select().from(simulationMessages).where(eq(simulationMessages.chatId, chatId));
  } catch (error) {
    console.error("Error fetching simulation_messages by chat:", error);
    throw error;
  }
}
