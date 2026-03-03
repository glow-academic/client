-- Indexes for materialized view: home_chat_mv
--

CREATE UNIQUE INDEX home_chat_mv_pk ON home_chat_mv (id);

CREATE INDEX home_chat_mv_created_at_idx ON home_chat_mv (created_at DESC);

CREATE INDEX home_chat_mv_home_id_idx ON home_chat_mv (home_id);

CREATE INDEX home_chat_mv_chat_id_idx ON home_chat_mv (chat_id);
