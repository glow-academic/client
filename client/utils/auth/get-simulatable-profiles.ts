// utils/queries/profiles/get-simulatable-profiles.ts
"use server";
import { auth } from "@/auth";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";

export async function getSimulatableProfiles(departmentIds: string[]) {
  try {
    // Get the current user's session to determine their profile
    const session = await auth();
    if (!session?.user?.id) {
      return [];
    }

    // Get the active user's profile
    const activeProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, parseInt(session.user.id)))
      .limit(1);

    if (!activeProfile || activeProfile.length === 0) {
      return [];
    }

    const userProfile = activeProfile[0];
    if (!userProfile) {
      return [];
    }

    // Business logic for simulation permissions
    let simulatableProfiles: (typeof profiles.$inferSelect)[] = [];

    // Build department filter condition
    // If no department IDs provided, include all profiles
    // Otherwise, include profiles in the specified departments OR superadmins with null departmentIds
    const departmentFilter =
      departmentIds.length > 0
        ? or(
            inArray(profiles.departmentId, departmentIds),
            and(isNull(profiles.departmentId), eq(profiles.role, "superadmin")),
          )
        : undefined;

    switch (userProfile.role) {
      case "superadmin":
        // Superadmins can simulate any profile except themselves (with department filter)
        simulatableProfiles = await db
          .select()
          .from(profiles)
          .where(
            departmentFilter
              ? and(ne(profiles.id, userProfile.id), departmentFilter)
              : ne(profiles.id, userProfile.id),
          );
        break;
      case "admin":
        // Admins can simulate any profile except themselves, other admins, and superadmins (with department filter)
        simulatableProfiles = await db
          .select()
          .from(profiles)
          .where(
            departmentFilter
              ? and(ne(profiles.id, userProfile.id), departmentFilter)
              : ne(profiles.id, userProfile.id),
          );
        // Filter out superadmin and admin profiles
        simulatableProfiles = simulatableProfiles.filter(
          (profile) =>
            profile.role !== "superadmin" && profile.role !== "admin",
        );
        break;

      case "instructional":
        // Instructional staff can simulate any profile except themselves, other instructional staff, admins, and superadmins (with department filter)
        simulatableProfiles = await db
          .select()
          .from(profiles)
          .where(
            departmentFilter
              ? and(ne(profiles.id, userProfile.id), departmentFilter)
              : ne(profiles.id, userProfile.id),
          );
        // Filter out superadmin, admin, and instructional staff profiles
        simulatableProfiles = simulatableProfiles.filter(
          (profile) =>
            profile.role !== "superadmin" &&
            profile.role !== "admin" &&
            profile.role !== "instructional",
        );
        break;
      case "ta":
      case "guest":
        // TAs and guests cannot simulate other profiles
        simulatableProfiles = [];
        break;

      default:
        simulatableProfiles = [];
        break;
    }

    return simulatableProfiles;
  } catch (error) {
    log.error("profiles.simulatable.fetch.failed", {
      message: "Error fetching simulatable profiles",
      error,
      context: { function: "getSimulatableProfiles" },
    });
    throw error;
  }
}
