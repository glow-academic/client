// utils/queries/simulation_chats/get-simulation-chats-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatsByUser(userId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.userId, userId));
  } catch (error) {
    console.error("Error fetching simulation_chats by user:", error);
    throw error;
  }
}
