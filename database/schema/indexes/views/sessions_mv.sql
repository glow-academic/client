-- Unique index on sessions_mv for REFRESH CONCURRENTLY support
CREATE UNIQUE INDEX idx_sessions_mv_session_id ON sessions_mv (session_id);
