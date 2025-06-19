// utils/mutations/components/delete-component.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteComponent(id: string) {
  try {
    const result = await db.delete(components).where(eq(components.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting component:", error);
    throw error;
  }
}
