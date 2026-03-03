-- Materialized View: eval_drafts_mv
-- Per-artifact draft MV for eval drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'eval_drafts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS eval_drafts_mv CASCADE;

CREATE MATERIALIZED VIEW eval_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM eval_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM eval_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'evals'::text AS resource_type, evals_id AS resource_id FROM eval_drafts_evals_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM eval_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::text AS resource_type, models_id AS resource_id FROM eval_drafts_models_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM eval_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'rubrics'::text AS resource_type, rubrics_id AS resource_id FROM eval_drafts_rubrics_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    d.group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'evals'), ARRAY[]::uuid[]) AS eval_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'models'), ARRAY[]::uuid[]) AS model_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'rubrics'), ARRAY[]::uuid[]) AS rubric_ids
FROM eval_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX eval_drafts_mv_pk ON eval_drafts_mv (draft_id);

REFRESH MATERIALIZED VIEW eval_drafts_mv;

CREATE MATERIALIZED VIEW eval_drafts_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM eval_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM eval_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'evals'::text AS resource_type, evals_id AS resource_id FROM eval_drafts_evals_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM eval_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::text AS resource_type, models_id AS resource_id FROM eval_drafts_models_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM eval_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'rubrics'::text AS resource_type, rubrics_id AS resource_id FROM eval_drafts_rubrics_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    d.group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'evals'), ARRAY[]::uuid[]) AS eval_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'models'), ARRAY[]::uuid[]) AS model_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'rubrics'), ARRAY[]::uuid[]) AS rubric_ids
FROM eval_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;
