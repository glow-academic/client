// Bulk edit — demo stories (paced, recorded), one per domain.
//
// Same setup + selection as bulk-delete: seed two rows via the factory, select
// them with `?selectedIds=`, then run the bulk edit (toolbar "Edit N" →
// BulkEditDialog → toggle the Active flag → Apply). The dialog closing confirms
// the change applied. Rows are tracked so teardown reaps them.
//
// Covers whatever the factory can seed and whose selection the library counts
// as editable; the rest skip/short-circuit cleanly — same partial-coverage
// shape as bulk-delete.

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { apiCreate, resolveId } from "../support/setup";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} bulk edit`, () => {
    test(`bulk-edit ${spec.plural}`, async ({
      page,
      demo,
      registry,
      request,
      runId,
    }) => {
      test.setTimeout(180_000);

      const names = [
        `BulkEdit ${spec.singular} A ${runId}`,
        `BulkEdit ${spec.singular} B ${runId}`,
      ];
      const ids: string[] = [];
      for (const name of names) {
        if (!(await apiCreate(request, key, name))) break;
        registry.track({ kind: key, name });
        const id = await resolveId(request, key, name);
        if (id) ids.push(id);
      }
      test.skip(ids.length < 2, `could not seed two ${spec.plural} via the factory`);

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.library.openSelected(ids);
      await facade.library.bulkEdit();

      await saveDemoVideo(page, `${spec.plural}-bulk-edit-story`);
    });
  });
}
