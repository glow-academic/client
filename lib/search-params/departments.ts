/**
 * Server-side search params schema for the departments list page.
 */
import { createLoader, parseAsString } from "nuqs/server";

export const departmentsSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadDepartmentsSearchParams = createLoader(departmentsSearchParams);
