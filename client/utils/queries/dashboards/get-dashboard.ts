// utils/queries/dashboards/get-dashboard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { dashboards } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getDashboard(id: string) {
  try {
    const result = await db.select().from(dashboards).where(eq(dashboards.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching dashboard:", error);
    throw error;
  }
}
