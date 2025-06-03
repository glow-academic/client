/**
 * app/template/page.tsx
 * Template list page - redirects to home with templates section
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TemplatePage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/home?section=templates");
  }, [router]);

  return null;
}
