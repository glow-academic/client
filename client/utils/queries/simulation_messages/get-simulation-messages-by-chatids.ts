// utils/queries/simulation_messages/get-simulation-messages-by-chatids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationMessagesByChatids(chatidIds: string[]) {
  try {
    return await db.select().from(simulationMessages).where(inArray(simulationMessages.chat_id, chatidIds));
  } catch (error) {
    console.error("Error fetching simulation_messages by chatids:", error);
    throw error;
  }
}
