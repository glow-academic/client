/**
 * Auth utilities — session snapshot construction.
 * Used by pages to build the SafeSessionSnapshot from NextAuth session + context profile.
 */
import type { Session } from "next-auth";
import type { ContextProfile } from "@/contexts/profile-context";

export type SafeSessionSnapshot = {
  profileId: string | null;
  isAuthenticated: boolean;
  idToken: string | null;
};

/**
 * Build a SafeSessionSnapshot from a session and context profile.
 * Used by pages that fetch /{artifact}/context and extract .profile.
 */
export function buildSnapshot(
  session: Session | null | undefined,
  profile: ContextProfile | null,
): SafeSessionSnapshot {
  return {
    profileId: profile?.id ?? null,
    isAuthenticated: !!session?.id_token,
    idToken: session?.id_token ?? null,
  };
}
