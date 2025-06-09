// utils/queries/simulation_messages/get-simulation-messages-by-chatid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationMessagesByChatid(chatidId: string) {
  try {
    return await db.select().from(simulationMessages).where(eq(simulationMessages.chat_id, chatidId));
  } catch (error) {
    console.error("Error fetching simulation_messages by chatid:", error);
    throw error;
  }
}
