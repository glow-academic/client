/**
 * Server-side search params schema for the profiles list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const profilesSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadProfilesSearchParams = createLoader(profilesSearchParams);
