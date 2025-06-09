// utils/queries/standards/get-standards-by-standardgroup.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardsByStandardgroup(standardgroupId: string) {
  try {
    return await db.select().from(standards).where(eq(standards.standard_group_id, standardgroupId));
  } catch (error) {
    console.error("Error fetching standards by standardgroup:", error);
    throw error;
  }
}
