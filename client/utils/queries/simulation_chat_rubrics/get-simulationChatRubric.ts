// utils/queries/simulation_chat_rubrics/get-simulationChatRubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatRubrics } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatRubric(id: string) {
  try {
    const result = await db.select().from(simulationChatRubrics).where(eq(simulationChatRubrics.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationChatRubric:", error);
    throw error;
  }
}
