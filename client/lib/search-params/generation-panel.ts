/**
 * Server-side search params schema for the AI generation panel
 * Uses nuqs/server for type-safe URL search param parsing
 * group_id is a global param available on any page
 */

import { createLoader, parseAsString } from "nuqs/server";

export const generationPanelSearchParams = {
  groupId: parseAsString,
};

export const loadGenerationPanelSearchParams = createLoader(
  generationPanelSearchParams,
);
