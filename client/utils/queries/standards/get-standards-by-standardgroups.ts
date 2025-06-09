// utils/queries/standards/get-standards-by-standardgroups.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardsByStandardgroups(standardgroupIds: string[]) {
  try {
    return await db.select().from(standards).where(inArray(standards.standard_group_id, standardgroupIds));
  } catch (error) {
    console.error("Error fetching standards by standardgroups:", error);
    throw error;
  }
}
