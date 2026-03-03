-- Indexes for materialized view: problems_mv
--

CREATE UNIQUE INDEX problems_mv_pk
    ON problems_mv (problem_id);

CREATE INDEX problems_mv_resolved_idx
    ON problems_mv (resolved);

CREATE INDEX problems_mv_created_at_idx
    ON problems_mv (problem_created_at DESC);

CREATE INDEX problems_mv_session_id_idx
    ON problems_mv (session_id);

CREATE INDEX problems_mv_profile_id_idx
    ON problems_mv (profile_id)
    WHERE profile_id IS NOT NULL;
