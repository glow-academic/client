// utils/mutations/dashboards/create-dashboard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDashboard(data: typeof dashboards.$inferInsert) {
  try {
    const result = await db.insert(dashboards).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating dashboard:", error);
    throw error;
  }
}
