// utils/queries/standards/get-all-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";

export async function getAllStandards() {
  try {
    return await db.select().from(standards);
  } catch (error) {
    console.error("Error fetching all standards:", error);
    throw error;
  }
}
