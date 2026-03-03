-- Indexes for materialized view: runs_mv
--

CREATE UNIQUE INDEX runs_mv_pk
    ON runs_mv (run_id);

CREATE INDEX runs_mv_group_id_idx
    ON runs_mv (group_id);

CREATE INDEX runs_mv_created_at_idx
    ON runs_mv (run_created_at DESC);

CREATE INDEX runs_mv_group_created_at_idx
    ON runs_mv (group_id, run_created_at DESC);

CREATE INDEX runs_mv_agent_ids_gin
    ON runs_mv USING GIN (agent_ids);

CREATE INDEX runs_mv_model_ids_gin
    ON runs_mv USING GIN (model_ids);

CREATE INDEX runs_mv_provider_ids_gin
    ON runs_mv USING GIN (provider_ids);
