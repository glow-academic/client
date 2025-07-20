// utils/queries/profiles/get-simulatable-profiles.ts
"use server";
import { auth } from "@/auth";
import { db } from "@/utils/drizzle/db";
import { classes, departments, profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { eq, inArray, ne } from "drizzle-orm";

export async function getSimulatableProfiles() {
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

    switch (userProfile.role) {
      case "superadmin":
        // Superadmins can simulate any profile except themselves
        simulatableProfiles = await db
          .select()
          .from(profiles)
          .where(ne(profiles.id, userProfile.id));
        break;
      case "admin":
        // Admins can simulate any profile except themselves and superadmins
        simulatableProfiles = await db
          .select()
          .from(profiles)
          .where(
            ne(profiles.id, userProfile.id)
          );
        // Filter out superadmin profiles
        simulatableProfiles = simulatableProfiles.filter(
          (profile) => profile.role !== "superadmin"
        );
        break;

      case "instructional":
        // Instructional staff can simulate instructor and ta profiles within their department(s)
        // First, get departments where the user is assigned
        const userDepartments = await db
          .select()
          .from(departments)
          .where(inArray(departments.profileIds, [[userProfile.id]]));

        if (userDepartments.length > 0) {
          // Get all profiles in those departments with instructor or ta roles
          const departmentProfiles = await db
            .select()
            .from(profiles)
            .where(
              inArray(
                profiles.id,
                userDepartments.flatMap((dept) => dept.profileIds)
              )
            );

          // Filter to only instructor and ta roles, excluding the user's own profile
          simulatableProfiles = departmentProfiles.filter(
            (profile) =>
              (profile.role === "instructor" || profile.role === "ta") &&
              profile.id !== userProfile.id
          );
        }
        break;

      case "instructor":
        // Instructors can simulate ta profiles linked to their classes
        const userClasses = await db
          .select()
          .from(classes)
          .where(inArray(classes.profileIds, [[userProfile.id]]));

        if (userClasses.length > 0) {
          const classProfileIds = userClasses.flatMap((cls) => cls.profileIds);

          // Get all profiles in those classes with ta role
          const classProfiles = await db
            .select()
            .from(profiles)
            .where(inArray(profiles.id, classProfileIds));

          // Filter to only ta roles, excluding the user's own profile
          simulatableProfiles = classProfiles.filter(
            (profile) => profile.role === "ta" && profile.id !== userProfile.id
          );
        }
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
    logError("Error fetching simulatable profiles:", error);
    throw error;
  }
}
