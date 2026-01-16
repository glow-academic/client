-- Get group_ids for persona resources before generation
-- Returns group_id for each resource type by following the chain:
-- Resource → call_id → calls.id → message_calls.call_id → message_calls.message_id → message_runs.message_id → message_runs.run_id → group_runs.run_id → group_runs.group_id
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_resource_group_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_resource_group_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_resource_group_ids_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    resource_types text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
    resource_type text,
    resource_id uuid,
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        persona_id AS persona_id,
        draft_id AS draft_id,
        profile_id AS profile_id,
        resource_types AS resource_types
),
-- Names group_id lookup
names_group_ids AS (
    SELECT 
        'names'::text as resource_type,
        COALESCE(
            (SELECT n.id FROM draft_names dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM persona_names pn WHERE pn.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_names dn ON dn.draft_id = x.draft_id
    LEFT JOIN names_resource n_draft ON n_draft.id = dn.names_id
    LEFT JOIN persona_names pn ON pn.persona_id = x.persona_id
    LEFT JOIN names_resource n_persona ON n_persona.id = pn.name_id
    LEFT JOIN calls c ON c.id = COALESCE(n_draft.call_id, n_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('names' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Descriptions group_id lookup
descriptions_group_ids AS (
    SELECT 
        'descriptions'::text as resource_type,
        COALESCE(
            (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pd.description_id FROM persona_descriptions pd WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_descriptions dd ON dd.draft_id = x.draft_id
    LEFT JOIN descriptions_resource d_draft ON d_draft.id = dd.descriptions_id
    LEFT JOIN persona_descriptions pd ON pd.persona_id = x.persona_id
    LEFT JOIN descriptions_resource d_persona ON d_persona.id = pd.description_id
    LEFT JOIN calls c ON c.id = COALESCE(d_draft.call_id, d_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('descriptions' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Colors group_id lookup
colors_group_ids AS (
    SELECT 
        'colors'::text as resource_type,
        COALESCE(
            (SELECT dc.colors_id FROM draft_colors dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pc.color_id FROM persona_colors pc WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_colors dc ON dc.draft_id = x.draft_id
    LEFT JOIN colors_resource c_draft ON c_draft.id = dc.colors_id
    LEFT JOIN persona_colors pc ON pc.persona_id = x.persona_id
    LEFT JOIN colors_resource c_persona ON c_persona.id = pc.color_id
    LEFT JOIN calls c ON c.id = COALESCE(c_draft.call_id, c_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('colors' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Icons group_id lookup
icons_group_ids AS (
    SELECT 
        'icons'::text as resource_type,
        COALESCE(
            (SELECT di.icons_id FROM draft_icons di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pi.icon_id FROM persona_icons pi WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_icons di ON di.draft_id = x.draft_id
    LEFT JOIN icons_resource i_draft ON i_draft.id = di.icons_id
    LEFT JOIN persona_icons pi ON pi.persona_id = x.persona_id
    LEFT JOIN icons_resource i_persona ON i_persona.id = pi.icon_id
    LEFT JOIN calls c ON c.id = COALESCE(i_draft.call_id, i_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('icons' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Instructions group_id lookup
instructions_group_ids AS (
    SELECT 
        'instructions'::text as resource_type,
        COALESCE(
            (SELECT dinst.instructions_id FROM draft_instructions dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pinst.instruction_id FROM persona_instructions pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_instructions dinst ON dinst.draft_id = x.draft_id
    LEFT JOIN instructions_resource inst_draft ON inst_draft.id = dinst.instructions_id
    LEFT JOIN persona_instructions pinst ON pinst.persona_id = x.persona_id
    LEFT JOIN instructions_resource inst_persona ON inst_persona.id = pinst.instruction_id
    LEFT JOIN calls c ON c.id = COALESCE(inst_draft.call_id, inst_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('instructions' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Flags group_id lookup
flags_group_ids AS (
    SELECT 
        'flags'::text as resource_type,
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pf.flag_id FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND f.name = 'active' AND pf.value = TRUE LIMIT 1)
        ) as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_flags df ON df.draft_id = x.draft_id
    LEFT JOIN flags_resource f_draft ON f_draft.id = df.flags_id
    LEFT JOIN persona_flags pf ON pf.persona_id = x.persona_id
    LEFT JOIN flags_resource f_persona ON f_persona.id = pf.flag_id
    LEFT JOIN flags_resource fl ON fl.id = COALESCE(f_draft.id, f_persona.id)
    LEFT JOIN calls c ON c.id = COALESCE(f_draft.call_id, f_persona.call_id)
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('flags' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
      AND (x.persona_id IS NULL OR EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = x.persona_id AND fl.name = 'active' AND pf.value = TRUE))
),
-- Departments group_id lookup (for each selected department)
departments_group_ids AS (
    SELECT 
        'departments'::text as resource_type,
        d.id as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN draft_departments dd ON dd.draft_id = x.draft_id
    LEFT JOIN persona_departments pd ON pd.persona_id = x.persona_id AND pd.active = true
    JOIN departments_resource d ON (
        (x.draft_id IS NOT NULL AND dd.departments_id = d.id)
        OR (x.persona_id IS NOT NULL AND pd.department_id = d.id)
    )
    LEFT JOIN calls c ON c.id = d.call_id
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE (x.draft_id IS NOT NULL OR x.persona_id IS NOT NULL)
      AND ('departments' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Fields group_id lookup (for each selected field)
fields_group_ids AS (
    SELECT 
        'fields'::text as resource_type,
        f.id as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN persona_fields pf ON pf.persona_id = x.persona_id AND pf.active = true
    JOIN fields_resource f ON (x.persona_id IS NOT NULL AND pf.field_id = f.id)
    LEFT JOIN calls c ON c.id = f.call_id
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE x.persona_id IS NOT NULL
      AND ('fields' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
),
-- Examples group_id lookup (for each selected example)
examples_group_ids AS (
    SELECT 
        'examples'::text as resource_type,
        e.id as resource_id,
        gr.group_id
    FROM params x
    LEFT JOIN persona_examples pe ON pe.persona_id = x.persona_id AND pe.active = true
    JOIN examples_resource e ON e.id = pe.example_id
    LEFT JOIN calls c ON c.id = e.call_id
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE x.persona_id IS NOT NULL
      AND ('examples' = ANY(x.resource_types) OR array_length(x.resource_types, 1) IS NULL)
)
SELECT resource_type, resource_id, group_id FROM names_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM descriptions_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM colors_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM icons_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM instructions_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM flags_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM departments_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM fields_group_ids WHERE resource_id IS NOT NULL
UNION ALL
SELECT resource_type, resource_id, group_id FROM examples_group_ids WHERE resource_id IS NOT NULL
$$;
