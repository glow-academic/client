-- Indexes for materialized view: test_invocation_mv
--

CREATE UNIQUE INDEX test_invocation_mv_pk
    ON test_invocation_mv (invocation_id);

CREATE INDEX test_invocation_mv_test_id_idx
    ON test_invocation_mv (test_id);

CREATE INDEX test_invocation_mv_completed_idx
    ON test_invocation_mv (invocation_completed);

CREATE INDEX test_invocation_mv_created_at_idx
    ON test_invocation_mv (invocation_created_at DESC);

CREATE INDEX test_invocation_mv_group_id_idx
    ON test_invocation_mv (group_id)
    WHERE group_id IS NOT NULL;

CREATE INDEX test_invocation_mv_run_ids_gin
    ON test_invocation_mv USING GIN (run_ids);
