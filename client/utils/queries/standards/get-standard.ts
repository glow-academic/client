// utils/queries/standards/get-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getStandard(id: string) {
  try {
    const result = await db
      .select()
      .from(standards)
      .where(eq(standards.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching standard:", error);
    throw error;
  }
}
