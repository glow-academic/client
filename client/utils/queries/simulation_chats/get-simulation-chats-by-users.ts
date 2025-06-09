// utils/queries/simulation_chats/get-simulation-chats-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatsByUsers(userIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.userId, userIds));
  } catch (error) {
    console.error("Error fetching simulation_chats by users:", error);
    throw error;
  }
}
