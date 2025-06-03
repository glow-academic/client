
"use server";
import { scenarios } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";

export async function updateScenario(id: string, name?: string, description?: string) {
  try {
    await db
      .update(scenarios)
      .set({ name, description })
      .where(eq(scenarios.id, id));
    return { success: true, error: "" };
  } catch (error) {
    return { success: false, error: "Failed to update scenario" };
  }
}
