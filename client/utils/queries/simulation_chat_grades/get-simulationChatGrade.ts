// utils/queries/simulation_chat_grades/get-simulationChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationChatGrade(id: string) {
  try {
    const result = await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationChatGrade:", error);
    throw error;
  }
}
