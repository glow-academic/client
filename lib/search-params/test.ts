/**
 * Server-side search params schema for the test detail page.
 */
import {
  createLoader,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

import { parseAsCommaSeparatedArray } from "./analytics";

export const testSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
  draftId: parseAsString,

  // Picker pagination — drives the bottom-composer run-config list.
  // Two-axis (groups-first):
  //   • configsGroupsPage / configsGroupsPageSize — outer page of
  //     group section headers.
  //   • configsExpanded — comma-separated group_ids the user has
  //     opened; only those groups load row payloads.
  //   • configsExpandedPageSize — rows per expanded group window.
  //   • configsSearch — free-text filter on group name.
  configsGroupsPage: parseAsInteger,
  configsGroupsPageSize: parseAsInteger,
  configsExpanded: parseAsCommaSeparatedArray,
  configsExpandedPageSize: parseAsInteger,
  configsSearch: parseAsString,
};

export const loadTestSearchParams = createLoader(testSearchParams);
