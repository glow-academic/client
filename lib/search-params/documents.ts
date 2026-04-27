/**
 * Server-side search params schema for the documents list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const documentsSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadDocumentsSearchParams = createLoader(documentsSearchParams);
