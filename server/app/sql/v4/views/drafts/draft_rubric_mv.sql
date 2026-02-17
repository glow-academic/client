-- Materialized View: draft_rubric_mv
-- Per-artifact draft MV for rubric drafts with denormalized resource IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'draft_rubric_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS draft_rubric_mv CASCADE;

CREATE MATERIALIZED VIEW draft_rubric_mv AS
WITH draft_links AS (
    SELECT draft_id, 'departments'::text AS resource_type, departments_id AS resource_id FROM rubric_drafts_departments_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::text AS resource_type, descriptions_id AS resource_id FROM rubric_drafts_descriptions_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::text AS resource_type, flags_id AS resource_id FROM rubric_drafts_flags_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::text AS resource_type, names_id AS resource_id FROM rubric_drafts_names_connection WHERE active = true
    UNION ALL SELECT draft_id, 'points'::text AS resource_type, points_id AS resource_id FROM rubric_drafts_points_connection WHERE active = true
    UNION ALL SELECT draft_id, 'rubrics'::text AS resource_type, rubrics_id AS resource_id FROM rubric_drafts_rubrics_connection WHERE active = true
    UNION ALL SELECT draft_id, 'standard_groups'::text AS resource_type, standard_groups_id AS resource_id FROM rubric_drafts_standard_groups_connection WHERE active = true
    UNION ALL SELECT draft_id, 'standards'::text AS resource_type, standards_id AS resource_id FROM rubric_drafts_standards_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,
    (SELECT ggc.groups_id FROM groups_groups_connection ggc WHERE ggc.group_id = d.group_id AND ggc.active = true LIMIT 1) AS group_id,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'points'), ARRAY[]::uuid[]) AS point_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'rubrics'), ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'standard_groups'), ARRAY[]::uuid[]) AS standard_group_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'standards'), ARRAY[]::uuid[]) AS standard_ids
FROM rubric_drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active, d.group_id
WITH NO DATA;

CREATE UNIQUE INDEX draft_rubric_mv_pk ON draft_rubric_mv (draft_id);

REFRESH MATERIALIZED VIEW draft_rubric_mv;
