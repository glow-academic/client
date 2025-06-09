// utils/queries/standards/get-standards-by-standardgroupid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardsByStandardgroupid(standardgroupidId: string) {
  try {
    return await db.select().from(standards).where(eq(standards.standard_group_id, standardgroupidId));
  } catch (error) {
    console.error("Error fetching standards by standardgroupid:", error);
    throw error;
  }
}
