"use server";
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/schema";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@/utils/drizzle/database";

export async function login(
  username: string,
  password: string,
  admin: boolean,
) {
  try {
    // Find the user by username
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    // If user doesn't exist, create the user
    if (user.length === 0) {
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert the new user
      const newUser = await db
        .insert(users)
        .values({
          name: username,
          username,
          password: hashedPassword,
          admin: admin,
        })
        .returning();

      if (newUser.length > 0) {
        // Create a JWT token without expiration
        const token = jwt.sign(
          { userId: newUser[0].id },
          process.env.JWT_SECRET!,
        );

        // Set the token in cookies with 10 year expiration
        (await cookies()).set({
          name: "auth_token",
          value: token,
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
          path: "/",
        });

        return { success: true, user: newUser[0], created: true };
      }

      return { success: false, error: "Failed to create user" };
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user[0].password);

    if (!passwordMatch) {
      return { success: false, error: "Invalid username or password" };
    }

    // update the status of the user to have admin = True if admin is not already true
    if (admin) {
      await db
        .update(users)
        .set({ admin: true })
        .where(eq(users.id, user[0].id));
    }

    // Create a JWT token without expiration
    const token = jwt.sign({ userId: user[0].id }, process.env.JWT_SECRET!);

    // Set the token in cookies with 10 year expiration
    (await cookies()).set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
      path: "/",
    });

    return { success: true, error: "" };
  } catch (error) {
    console.error("Error logging in:", error);
    return {
      success: false,
      error: "An error occurred during login: " + error,
    };
  }
}
