-- Indexes for materialized view: chat_mv
--

CREATE UNIQUE INDEX chat_mv_pk
    ON chat_mv (chat_entry_id);

CREATE INDEX chat_mv_parent_id_idx
    ON chat_mv (parent_id);

CREATE INDEX chat_mv_scenario_id_idx
    ON chat_mv (scenario_id);

CREATE INDEX chat_mv_department_ids_gin_idx
    ON chat_mv USING GIN (department_ids);
