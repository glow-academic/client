/**
 * Server-side search params schema for the settings list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const settingsSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadSettingsSearchParams = createLoader(settingsSearchParams);
