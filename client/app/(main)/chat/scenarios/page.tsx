/**
 * app/scenario/page.tsx
 * Scenario list page - redirects to home with scenarios section
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScenarioPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/home?section=scenarios");
  }, [router]);

  return null;
}
