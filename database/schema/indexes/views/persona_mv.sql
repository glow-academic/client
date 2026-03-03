-- Indexes for materialized view: personas_mv
--

CREATE UNIQUE INDEX personas_mv_pk ON personas_mv (id);

CREATE INDEX personas_mv_created_at_idx ON personas_mv (created_at DESC);
