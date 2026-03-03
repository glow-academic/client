-- Indexes for materialized view: resolves_mv
--

CREATE UNIQUE INDEX resolves_mv_pk ON resolves_mv (id);

CREATE INDEX resolves_mv_created_at_idx ON resolves_mv (created_at DESC);

CREATE INDEX resolves_mv_problem_id_idx ON resolves_mv (problem_id);
