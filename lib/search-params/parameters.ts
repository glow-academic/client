/**
 * Server-side search params schema for the parameters list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const parametersSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadParametersSearchParams = createLoader(parametersSearchParams);
