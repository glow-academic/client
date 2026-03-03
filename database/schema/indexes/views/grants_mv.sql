-- Indexes for materialized view: grants_mv
--

CREATE UNIQUE INDEX grants_mv_pk
    ON grants_mv (grant_id);

CREATE INDEX grants_mv_grantor_id_idx
    ON grants_mv (grantor_id)
    WHERE grantor_id IS NOT NULL;

CREATE INDEX grants_mv_emulated_id_idx
    ON grants_mv (emulated_id)
    WHERE emulated_id IS NOT NULL;

CREATE INDEX grants_mv_grant_session_id_idx
    ON grants_mv (grant_session_id)
    WHERE grant_session_id IS NOT NULL;

CREATE INDEX grants_mv_emulation_session_id_idx
    ON grants_mv (emulation_session_id)
    WHERE emulation_session_id IS NOT NULL;

CREATE INDEX grants_mv_created_at_idx
    ON grants_mv (created_at DESC);
