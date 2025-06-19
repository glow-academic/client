// utils/mutations/dashboards/delete-dashboards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteDashboards(ids: string[]) {
  try {
    return await db.delete(dashboards).where(inArray(dashboards.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple dashboards:", error);
    throw error;
  }
}
