-- Indexes for materialized view: messages_mv
--

CREATE UNIQUE INDEX messages_mv_pk
    ON messages_mv (message_id);

CREATE INDEX messages_mv_run_id_idx
    ON messages_mv (run_id);

CREATE INDEX messages_mv_run_role_created_idx
    ON messages_mv (run_id, role, message_created_at);
