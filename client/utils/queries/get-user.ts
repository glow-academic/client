// utils/queries/get-user.ts
"use server"
import { eq } from 'drizzle-orm';
import { users } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function getUser() {
    const db = drizzle(process.env.DATABASE_URL!);
    
    // Get the token from cookies
    const token = (await cookies()).get('auth_token')?.value;
    
    if (!token) {
        return null;
    }
    
    try {
        // Verify and decode the JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const userId = decoded.userId;
        
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        return user[0] || null;
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}
