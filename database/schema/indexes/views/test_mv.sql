-- Indexes for materialized view: test_mv
--

CREATE UNIQUE INDEX test_mv_pk
    ON test_mv (test_id);

CREATE INDEX test_mv_eval_id_idx
    ON test_mv (eval_id);

CREATE INDEX test_mv_profile_id_idx
    ON test_mv (profile_id);

CREATE INDEX test_mv_benchmark_id_idx
    ON test_mv (benchmark_id);

CREATE INDEX test_mv_archived_idx
    ON test_mv (archived);

CREATE INDEX test_mv_created_at_idx
    ON test_mv (test_created_at DESC);

CREATE INDEX test_mv_department_ids_gin
    ON test_mv USING GIN (department_ids);
