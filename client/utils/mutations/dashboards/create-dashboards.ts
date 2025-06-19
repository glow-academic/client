// utils/mutations/dashboards/create-dashboards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createDashboards(data: (typeof dashboards.$inferInsert)[]) {
  try {
    return await db.insert(dashboards).values(data).returning();
  } catch (error) {
    logError("Error creating multiple dashboards:", error);
    throw error;
  }
}
