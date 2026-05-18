/**
 * ackOperation — generic accept/reject for any pending audited operation.
 *
 * Every audited write route (`/<artifact>/<operation>`) accepts the
 * minimal ack body `{idempotency_key, accept}` — the impl-side ack
 * short-circuit locates the dormant row by ``idempotency_key`` and
 * promotes (accept=true) or rejects (accept=false) without needing the
 * original first-call params.
 *
 * The route segments are derivable from any of the call's audit events
 * (e.g. ``"persona.draft.started"`` → ``/persona/draft``), so a single
 * server action handles every artifact/operation pair without per-route
 * wiring.
 */

"use server";

import { api } from "@/lib/api/client";

export interface AckOperationInput {
  /** First segment of the audit event name — e.g. ``"persona"``. */
  artifact: string;
  /** Second segment of the audit event name — e.g. ``"draft"``. */
  operation: string;
  /** The original soft call's ``call_id`` (= operation_key in the
   *  receipt's events). The impl uses this to locate the dormant row. */
  idempotencyKey: string;
  /** ``true`` to promote, ``false`` to reject. */
  accept: boolean;
}

// Generic, per-call route — bypasses OpenAPI's per-route typing on
// purpose. The audit framework guarantees every ``/<artifact>/<operation>``
// write route accepts the minimal ack body, so the typed surface isn't
// useful here.
type ApiPostFn = (
  path: string,
  init: { body: Record<string, unknown> },
) => Promise<Record<string, unknown>>;

export async function ackOperation(
  input: AckOperationInput,
): Promise<Record<string, unknown>> {
  const path = `/${input.artifact}/${input.operation}`;
  const post = api.post as unknown as ApiPostFn;
  return await post(path, {
    body: {
      idempotency_key: input.idempotencyKey,
      accept: input.accept,
    },
  });
}
