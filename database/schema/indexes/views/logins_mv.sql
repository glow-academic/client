-- Indexes for materialized view: logins_mv
--

CREATE UNIQUE INDEX logins_mv_pk
    ON logins_mv (login_id);

CREATE INDEX logins_mv_profile_id_idx
    ON logins_mv (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX logins_mv_session_id_idx
    ON logins_mv (session_id);

CREATE INDEX logins_mv_last_login_idx
    ON logins_mv (last_login DESC);

CREATE INDEX logins_mv_created_at_idx
    ON logins_mv (login_created_at DESC);

CREATE INDEX logins_mv_active_idx
    ON logins_mv (active);
