// utils/queries/simulation_messages/get-simulation-messages-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationMessagesByChats(chatIds: string[]) {
  try {
    return await db.select().from(simulationMessages).where(inArray(simulationMessages.chatId, chatIds));
  } catch (error) {
    console.error("Error fetching simulation_messages by chats:", error);
    throw error;
  }
}
