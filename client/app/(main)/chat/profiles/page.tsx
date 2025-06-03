/**
 * app/profile/page.tsx
 * Profile list page - redirects to home with profiles section
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/home?section=profiles");
  }, [router]);

  return null;
}
