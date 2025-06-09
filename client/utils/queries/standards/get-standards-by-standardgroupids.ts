// utils/queries/standards/get-standards-by-standardgroupids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getStandardsByStandardgroupids(standardgroupidIds: string[]) {
  try {
    return await db.select().from(standards).where(inArray(standards.standard_group_id, standardgroupidIds));
  } catch (error) {
    console.error("Error fetching standards by standardgroupids:", error);
    throw error;
  }
}
