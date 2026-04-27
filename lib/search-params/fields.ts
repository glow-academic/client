/**
 * Server-side search params schema for the fields list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const fieldsSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadFieldsSearchParams = createLoader(fieldsSearchParams);
