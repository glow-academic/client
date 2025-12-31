/**
 * Client-side search params schema for persona pages
 * Uses nuqs for type-safe URL search param parsing
 * This file must be imported only by client components
 */

"use client";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs";

// Client-side parsers for persona form fields
export const personaSearchParamsClient = {
  name: parseAsString,
  description: parseAsString,
  color: parseAsString,
  icon: parseAsString,
  instructions: parseAsString,
  active: parseAsBoolean,
  departmentIds: parseAsArrayOf(parseAsString),
  parameterIds: parseAsArrayOf(parseAsString),
  parameterFieldIds: parseAsArrayOf(parseAsString),
  // Search params (URL-backed)
  colorSearch: parseAsString,
  iconSearch: parseAsString,
};

