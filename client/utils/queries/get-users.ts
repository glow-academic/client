// utils/queries/get-user.ts
"use server"
import { users } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getUsers() {
    const db = drizzle(process.env.DATABASE_URL!);

    const allUsers = await db.select().from(users);
    return allUsers;
}
