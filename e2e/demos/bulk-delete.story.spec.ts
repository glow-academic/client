// Bulk delete — demo stories (paced, recorded), one per domain.
//
// Setup-via-API: seed two fresh rows through the factory (apiCreate), resolve
// their ids, then select them deterministically with `?selectedIds=` and run
// the bulk delete (toolbar "Delete N" → BulkDeleteDialog → confirm). Both rows
// are tracked so teardown reaps them if the delete fails (a successful delete
// makes teardown a safe no-op).
//
// Covers whatever the factory can seed: the name-only domains + persona. Domains
// gated by the backend resolution gap (can't seed 2 valid rows) skip cleanly —
// same partial-coverage shape as create/edit.

import { test, expect } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { apiCreate, resolveId } from "../support/setup";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} bulk delete`, () => {
    test(`bulk-delete ${spec.plural}`, async ({
      page,
      demo,
      registry,
      request,
      runId,
    }) => {
      test.setTimeout(180_000);

      // Seed two rows we own.
      const names = [
        `Bulk ${spec.singular} A ${runId}`,
        `Bulk ${spec.singular} B ${runId}`,
      ];
      const ids: string[] = [];
      for (const name of names) {
        if (!(await apiCreate(request, key, name))) break;
        registry.track({ kind: key, name }); // safety net if the delete fails
        const id = await resolveId(request, key, name);
        if (id) ids.push(id);
      }
      test.skip(ids.length < 2, `could not seed two ${spec.plural} via the factory`);

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.library.openSelected(ids);
      await facade.library.bulkDelete();

      // Verify they're gone: re-open, search one name, expect no card.
      await facade.open();
      await facade.search(names[0]!);
      await expect(facade.card(names[0]!)).toHaveCount(0);

      await saveDemoVideo(page, `${spec.plural}-bulk-delete-story`);
    });
  });
}
