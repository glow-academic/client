"use server";
import { scenarios } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function deleteScenario(id: string) {
  try {
    const deletedScenario = await db
      .delete(scenarios)
      .where(eq(scenarios.id, id))
      .returning();

    if (deletedScenario.length === 0) {
      return { success: false, error: "Scenario not found" };
    }

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error deleting scenario:", error);
    return { success: false, error: "Failed to delete scenario" };
  }
} 