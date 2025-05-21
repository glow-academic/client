// utils/queries/get-user.ts
"use server";
import { users } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getUsers() {
  const allUsers = await db.select().from(users);
  return allUsers;
}
