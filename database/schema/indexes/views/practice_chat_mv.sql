-- Indexes for materialized view: practice_chat_mv
--

CREATE UNIQUE INDEX practice_chat_mv_pk ON practice_chat_mv (id);

CREATE INDEX practice_chat_mv_created_at_idx ON practice_chat_mv (created_at DESC);

CREATE INDEX practice_chat_mv_practice_id_idx ON practice_chat_mv (practice_id);

CREATE INDEX practice_chat_mv_chat_id_idx ON practice_chat_mv (chat_id);
