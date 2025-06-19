// utils/queries/dashboards/get-all-dashboards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllDashboards() {
  try {
    return await db.select().from(dashboards);
  } catch (error) {
    logError("Error fetching all dashboards:", error);
    throw error;
  }
}
