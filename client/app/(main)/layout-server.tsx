/**
 * Server component that fetches profile context data
 */
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LayoutContextIn = InputOf<"/api/v3/profile/context", "post">;
type LayoutContextOut = OutputOf<"/api/v3/profile/context", "post">;

/** ---- Cached fetch ---- */
const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    return api.post("/profile/context", input);
  }
);

/** ---- Export type for client (type-only imports) ---- */
export type LayoutContextResponse = LayoutContextOut;

export type SafeSessionSnapshot = {
  effectiveProfileId: string | null;
  fullEmulation: boolean;
  emulationTTL: number | null;
};

export async function getLayoutContextData() {
  const session = await auth();

  const snapshot: SafeSessionSnapshot = {
    effectiveProfileId: session?.effectiveProfileId ?? null,
    fullEmulation: !!session?.fullEmulation,
    emulationTTL: session?.emulationTTL ?? null,
  };

  const effectiveProfileId = session?.effectiveProfileId || "";
  const actualProfileId = session?.user?.profileId || "";

  // IMPORTANT: server overrides IDs internally; you still pass something for typing parity
  const initial = await getLayoutContext({
    body: {
      actualProfileId,
      effectiveProfileId,
      pathname: "/", // layout-level; pages can still supply their own on demand
    },
  });

  return { initial, snapshot };
}
