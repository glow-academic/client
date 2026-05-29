// TODO: placeholder demo — needs a supervised pass.
// The GenerationPanel on the library surface is contextual (Generate stays
// disabled until personas are *selected*, not just instructions filled) and
// renders multiple responsive branches. testids exist (gp-generate/gp-settings/
// gp-safe-mode) + genDemo helper is ready; the open+select+generate flow needs
// interactive debugging (and a live AI run) to finalize. audit-replay = same
// panel with gp-safe-mode on (soft→accept path).
import { test } from "@playwright/test";

test.describe("demo: audit-replay", () => {
  test.fixme("needs supervised gen-panel pass (contextual select + live run)", async () => {});
});
