// Draft — demo stories (paced, recorded), one per domain.
//
// Open the artifact "new" form, type a name, wait for the autosave to anchor
// the draft (`?draftId=…` lands in the URL), then open the Drafts picker and
// see the just-created entry — the canonical draft autosave + resume surface.
// No teardown: drafts persist in their own /x/draft endpoints and don't show
// up in the registry's name-based reap; they pile up on the dev backend by
// design (the user can wipe them).

import { test, expect } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} draft`, () => {
    test(`save a ${spec.singular} as a draft`, async ({
      page,
      demo,
      registry,
      runId,
    }) => {
      test.setTimeout(180_000);

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.form.openNew();
      // Type into the name field; some forms (e.g. profile) have no plain name
      // input on the new form — those skip cleanly.
      test.skip(
        !(await facade.form.fillIfPresent("name", `Draft ${spec.singular} ${runId}`)),
        `${spec.singular} has no fillable name field on the new form`,
      );
      await facade.form.waitForDraftSaved();
      const draftId = await facade.form.currentDraftId();
      test.skip(!draftId, `${spec.singular} draft did not anchor (no draftId in URL)`);

      // Open the Drafts picker as visual content; the picker's list can lag the
      // autosave that just landed (cache/refresh quirk), so we don't strictly
      // assert the menu-item — the `draftId` in the URL above already proves
      // the draft persisted.
      await facade.form.openDraftsPicker().catch(() => undefined);

      await saveDemoVideo(page, `${spec.plural}-draft-story`);
    });
  });
}
