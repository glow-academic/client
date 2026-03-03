-- Indexes for materialized view: groups_mv
--

CREATE UNIQUE INDEX groups_mv_pk
    ON groups_mv (group_id);

CREATE INDEX groups_mv_session_id_idx
    ON groups_mv (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX groups_mv_created_at_idx
    ON groups_mv (group_created_at DESC);

CREATE INDEX groups_mv_session_created_at_idx
    ON groups_mv (session_id, group_created_at DESC)
    WHERE session_id IS NOT NULL;
