/**
 * Server-side search params schema for the auth list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const authSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadAuthSearchParams = createLoader(authSearchParams);
