-- Indexes for materialized view: benchmark_mv
--

CREATE UNIQUE INDEX benchmark_mv_pk
    ON benchmark_mv (benchmark_id);

CREATE INDEX benchmark_mv_use_groups_idx
    ON benchmark_mv (use_groups);

CREATE INDEX benchmark_mv_dynamic_idx
    ON benchmark_mv (dynamic);

CREATE INDEX benchmark_mv_eval_ids_gin_idx
    ON benchmark_mv USING GIN (eval_ids);

CREATE INDEX benchmark_mv_department_ids_gin_idx
    ON benchmark_mv USING GIN (department_ids);

CREATE INDEX benchmark_mv_profile_ids_gin_idx
    ON benchmark_mv USING GIN (profile_ids);
