/**
 * app/(main)/health/page.tsx
 * System health page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Logs from "@/components/logs/Logs";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type HealthBundleIn = InputOf<"/api/v4/health/bundle", "post">;
type HealthBundleOut = OutputOf<"/api/v4/health/bundle", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHealthBundle = cache(
  async (input: HealthBundleIn): Promise<HealthBundleOut> => {
    return api.post("/health/bundle", input);
  },
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Health",
    description:
      "System health monitoring and diagnostics for teaching assistant training platform. Monitor platform performance, check system status, and maintain operational health for educational institutions and L&D programs.",
  };
}

interface HealthPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HealthPage(_props: HealthPageProps) {
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header (auto-injected)

  // Fetch bundle data server-side (for KPIs and metrics)
  const bundleData = await getHealthBundle({
    body: {},
  });

  return (
    <div className="space-y-6">
      <Logs bundleData={bundleData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HealthBundleIn, HealthBundleOut };
