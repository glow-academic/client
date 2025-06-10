// utils/queries/standards/get-standards-by-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandardsByStandardGroup(standardGroupId: string) {
  try {
    return await db
      .select()
      .from(standards)
      .where(eq(standards.standardGroupId, standardGroupId));
  } catch (error) {
    console.error("Error fetching standards by standardGroup:", error);
    throw error;
  }
}
