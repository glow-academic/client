// utils/mutations/dashboards/update-dashboard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateDashboard(id: string, data: Partial<typeof dashboards.$inferInsert>) {
  try {
    const result = await db.update(dashboards).set(data).where(eq(dashboards.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating dashboard:", error);
    throw error;
  }
}
