// hooks/use-auth.ts
"use client";
import { useState, useEffect } from "react";
import { getAuthUserId } from "@/utils/auth/get-auth-user";

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAuthUser() {
      try {
        setIsLoading(true);
        const userId = await getAuthUserId();
        setUserId(userId || null);
      } catch (error) {
        console.error("Error fetching auth user:", error);
        setUserId(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAuthUser();
  }, []);

  return {
    userId,
    isLoading,
    isAuthenticated: !!userId,
  };
}
