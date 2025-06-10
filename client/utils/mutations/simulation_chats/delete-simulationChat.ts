// utils/mutations/simulation_chats/delete-simulationChat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationChat(id: string) {
  try {
    const result = await db
      .delete(simulationChats)
      .where(eq(simulationChats.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationChat:", error);
    throw error;
  }
}
