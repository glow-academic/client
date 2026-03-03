-- Indexes for materialized view: conversations_mv
--

CREATE UNIQUE INDEX conversations_mv_pk ON conversations_mv (id);

CREATE INDEX conversations_mv_created_at_idx ON conversations_mv (created_at DESC);

CREATE INDEX conversations_mv_chat_id_idx ON conversations_mv (chat_id);
