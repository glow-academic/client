-- Indexes for materialized view: invocation_mv
--

CREATE UNIQUE INDEX invocation_mv_pk
    ON invocation_mv (invocation_entry_id);

CREATE INDEX invocation_mv_benchmark_id_idx
    ON invocation_mv (benchmark_id);

CREATE INDEX invocation_mv_department_ids_gin_idx
    ON invocation_mv USING GIN (department_ids);
