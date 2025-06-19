// utils/mutations/dashboards/delete-dashboard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDashboard(id: string) {
  try {
    const result = await db.delete(dashboards).where(eq(dashboards.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting dashboard:", error);
    throw error;
  }
}
