-- Indexes for materialized view: sessions_mv
--

CREATE UNIQUE INDEX sessions_mv_pk
    ON sessions_mv (session_id);

CREATE INDEX sessions_mv_profile_id_idx
    ON sessions_mv (profile_id);

CREATE INDEX sessions_mv_created_at_idx
    ON sessions_mv (session_created_at DESC);

CREATE INDEX sessions_mv_active_idx
    ON sessions_mv (active);

CREATE INDEX sessions_mv_profile_created_at_idx
    ON sessions_mv (profile_id, session_created_at DESC);
