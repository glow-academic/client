/**
 * Server-side search params schema for the attempt detail page.
 */
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

export const attemptSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
  draftId: parseAsString,
  infiniteMode: parseAsBoolean,
  userInstructions: parseAsString,
};

export const loadAttemptSearchParams = createLoader(attemptSearchParams);
