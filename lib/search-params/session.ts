/**
 * Server-side search params schema for the activity session detail page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const sessionSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadSessionSearchParams = createLoader(sessionSearchParams);
