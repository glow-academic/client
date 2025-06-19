// utils/mutations/dashboards/update-dashboards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateDashboards(ids: string[], data: Partial<typeof dashboards.$inferInsert>) {
  try {
    return await db.update(dashboards).set(data).where(inArray(dashboards.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple dashboards:", error);
    throw error;
  }
}
