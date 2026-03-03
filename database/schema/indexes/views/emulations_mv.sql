-- Indexes for materialized view: emulations_mv
--

CREATE UNIQUE INDEX emulations_mv_pk ON emulations_mv (id);

CREATE INDEX emulations_mv_created_at_idx ON emulations_mv (created_at DESC);

CREATE INDEX emulations_mv_session_id_idx ON emulations_mv (session_id);

CREATE INDEX emulations_mv_grant_id_idx ON emulations_mv (grant_id);
