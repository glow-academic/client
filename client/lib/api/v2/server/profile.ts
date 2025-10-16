/**
 * Server-side fetcher functions for profile v2 API
 * Memoized with React cache to prevent duplicate requests
 * Used for server-side prefetching and in auth.ts
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { ProfileRole } from "../schemas/base";
import {
  CreateProfileRequestSchema,
  CreateProfileResponseSchema,
  CreateUserProfileRequest,
  CreateUserProfileResponseSchema,
  ProfileDetailResponseSchema,
  ProfileSimpleDetailResponseSchema,
  UserProfilesListResponseSchema,
} from "../schemas/profile";

/**
 * Fetch profile detail from FastAPI server (memoized)
 * Used for prefetching profile data in pages
 */
export const fetchProfileDetail = cache(
  async (profileId: string, currentProfileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/profile/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileId, currentProfileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch profile detail");
    }

    const data = await res.json();
    return ProfileDetailResponseSchema.parse(data);
  }
);

/**
 * Fetch simple profile detail from FastAPI server (memoized)
 * Used for auth operations and simple profile lookups
 */
export const fetchProfileSimple = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/profile/detail-simple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch simple profile detail");
  }

  const data = await res.json();
  return ProfileSimpleDetailResponseSchema.parse(data);
});

/**
 * Fetch profile by alias from FastAPI server (memoized)
 * Used in auth.ts for profile lookup by alias during sign-in
 */
export const fetchProfileByAlias = cache(async (alias: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/profile/by-alias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ alias }),
  });

  if (!res.ok) {
    return null; // Return null if not found (404 or error)
  }

  const data = await res.json();
  const parsed = ProfileSimpleDetailResponseSchema.parse(data);
  return parsed.profile;
});

/**
 * Fetch user_profiles by user ID from FastAPI server (memoized)
 * Used in auth.ts to find profile links for a user
 */
export const fetchUserProfilesByUser = cache(async (userId: number) => {
  const res = await fetch(
    `${getApiBase()}/api/v2/profile/user-profiles/list-by-user`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch user profiles by user");
  }

  const data = await res.json();
  return UserProfilesListResponseSchema.parse(data).userProfiles;
});

/**
 * Fetch user_profiles by profile ID from FastAPI server (memoized)
 * Used in auth.ts to check if profile is already linked to a user
 */
export const fetchUserProfilesByProfile = cache(async (profileId: string) => {
  const res = await fetch(
    `${getApiBase()}/api/v2/profile/user-profiles/list-by-profile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileId }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch user profiles by profile");
  }

  const data = await res.json();
  return UserProfilesListResponseSchema.parse(data).userProfiles;
});

/**
 * Create a user_profile link (not memoized - this is a mutation)
 * Used in auth.ts to link a user to a profile
 */
export const createUserProfile = async (data: CreateUserProfileRequest) => {
  const res = await fetch(
    `${getApiBase()}/api/v2/profile/user-profiles/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to create user profile link");
  }

  const result = await res.json();
  return CreateUserProfileResponseSchema.parse(result).userProfile;
};

/**
 * Update profile simple (not memoized - this is a mutation)
 * Used in auth.ts to update profile fields like lastLogin, firstName, lastName
 */
export const updateProfileSimple = async (
  profileId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    lastLogin?: string;
    viewedIntro?: boolean;
    viewedChat?: boolean;
    reqPerDay?: number | null;
    active?: boolean;
  }
) => {
  const res = await fetch(`${getApiBase()}/api/v2/profile/update-simple`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId, ...updates }),
  });

  if (!res.ok) {
    throw new Error("Failed to update profile");
  }

  const data = await res.json();
  const parsed = ProfileSimpleDetailResponseSchema.parse(data);
  return parsed.profile;
};

/**
 * Create a new profile (not memoized - this is a mutation)
 * Used in auth.ts during user creation flow
 */
export const createProfile = async (data: {
  firstName: string;
  lastName: string;
  alias: string;
  role: ProfileRole;
  department_id?: string;
}) => {
  const validated = CreateProfileRequestSchema.parse(data);

  const res = await fetch(`${getApiBase()}/api/v2/profile/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create profile: ${res.status} ${errorText}`);
  }

  const result = await res.json();
  const parsed = CreateProfileResponseSchema.parse(result);

  // Fetch the created profile to return full profile data
  const profile = await fetchProfileSimple(parsed.profileId);
  return profile.profile;
};
