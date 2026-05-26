// Registry — tracks entities a test created so teardown can reap them.
//
// The action layer calls `track()` the moment it commits a create (before
// the network round-trip, so a mid-submit crash still records it). After
// the test, the `registry` fixture drains this list and deletes each
// entity via the backend API — pass or fail. See support/teardown.ts.
//
// We track by the run-scoped *name* (not an id) because creates happen
// through the UI form, which never surfaces the new id to the test. The
// name is unique per run, so teardown resolves name -> id -> delete
// against the live backend.

export interface TrackedEntity {
  /** Domain singular, e.g. "persona" — keys into DOMAINS for endpoints. */
  kind: string;
  /** Unique, run-scoped name the test typed into the form. */
  name: string;
}

export class Registry {
  private readonly entities: TrackedEntity[] = [];

  track(entity: TrackedEntity): void {
    this.entities.push(entity);
  }

  /** Return everything tracked and clear the list (single-use teardown). */
  drain(): TrackedEntity[] {
    return this.entities.splice(0);
  }
}
