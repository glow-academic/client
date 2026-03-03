-- Indexes for materialized view: activity_mv
--

CREATE UNIQUE INDEX activity_mv_pk
    ON activity_mv (activity_id);

CREATE INDEX activity_mv_profile_id_idx
    ON activity_mv (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX activity_mv_session_id_idx
    ON activity_mv (session_id);

CREATE INDEX activity_mv_created_at_idx
    ON activity_mv (created_at DESC);
