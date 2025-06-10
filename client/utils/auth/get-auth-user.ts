// utils/auth/get-auth-user.ts
"use server";
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function getAuthUserId() {
  // Get the token from cookies
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) {
    return null;
  }

  try {
    // Verify and decode the JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    const userId = decoded.userId;
    return userId;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}
