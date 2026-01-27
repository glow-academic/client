-- Persona ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs and suggestions using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_ids_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or persona junction)
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    field_ids uuid[],
    example_ids uuid[],

    -- Suggestion IDs (for resource options)
    name_suggestions uuid[],
    description_suggestions uuid[],
    color_suggestions uuid[],
    icon_suggestions uuid[],
    instructions_suggestions uuid[],
    department_suggestions uuid[],
    field_suggestions uuid[],
    example_suggestions uuid[],

    -- Agent IDs (for generate buttons)
    name_agent_id uuid,
    description_agent_id uuid,
    color_agent_id uuid,
    icon_agent_id uuid,
    instructions_agent_id uuid,
    flag_agent_id uuid,
    departments_agent_id uuid,
    fields_agent_id uuid,
    examples_agent_id uuid,
    basic_agent_id uuid,
    content_agent_id uuid,
    general_agent_id uuid,

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    colors_has_tools boolean,
    icons_has_tools boolean,
    instructions_has_tools boolean,
    departments_has_tools boolean,
    fields_has_tools boolean,
    examples_has_tools boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Draft multi-select resource IDs
draft_departments_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN departments_drafts_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
draft_fields_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(df.fields_id ORDER BY df.created_at), NULL), ARRAY[]::uuid[]) as field_ids
    FROM params x
    LEFT JOIN fields_drafts_connection df ON df.draft_id = x.draft_id
    LIMIT 1
),
draft_examples_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(de.examples_id ORDER BY de.created_at), NULL), ARRAY[]::uuid[]) as example_ids
    FROM params x
    LEFT JOIN examples_drafts_connection de ON de.draft_id = x.draft_id
    LIMIT 1
),
-- Persona junction multi-select resource IDs
persona_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM persona_departments_junction pd
                 WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
persona_fields_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at)
                 FROM persona_fields_junction pf
                 WHERE pf.persona_id = (SELECT persona_id FROM params) AND pf.active = true),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    LIMIT 1
),
persona_examples_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(e.id ORDER BY pe.idx)
                 FROM persona_examples_junction pe
                 JOIN examples_resource e ON e.id = pe.example_id
                 WHERE pe.persona_id = (SELECT persona_id FROM params) AND pe.active = true),
                ARRAY[]::uuid[]
            )
        END as example_ids
    FROM params
    LIMIT 1
),
-- Combined multi-select IDs (draft preferred over persona)
persona_departments_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM persona_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM persona_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
persona_fields_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT field_ids FROM draft_fields_data), 1), 0) > 0
                THEN (SELECT field_ids FROM draft_fields_data)
            WHEN COALESCE(array_length((SELECT field_ids FROM persona_fields_junction_data), 1), 0) > 0
                THEN (SELECT field_ids FROM persona_fields_junction_data)
            ELSE ARRAY[]::uuid[]
        END as field_ids
    FROM params
    LIMIT 1
),
persona_examples_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT example_ids FROM draft_examples_data), 1), 0) > 0
                THEN (SELECT example_ids FROM draft_examples_data)
            WHEN COALESCE(array_length((SELECT example_ids FROM persona_examples_junction_data), 1), 0) > 0
                THEN (SELECT example_ids FROM persona_examples_junction_data)
            ELSE ARRAY[]::uuid[]
        END as example_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or persona junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pn.name_id FROM persona_names_junction pn WHERE pn.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as description_id
    FROM params
),
color_resource_data AS (
    SELECT COALESCE(
        (SELECT dc.colors_id FROM colors_drafts_connection dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as color_id
    FROM params
),
icon_resource_data AS (
    SELECT COALESCE(
        (SELECT di.icons_id FROM icons_drafts_connection di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as icon_id
    FROM params
),
instructions_resource_data AS (
    SELECT COALESCE(
        (SELECT dinst.instructions_id FROM instructions_drafts_connection dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pinst.instruction_id FROM persona_instructions_junction pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as instructions_id
    FROM params
),
flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pf.flag_id FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND f.name = 'persona_active' AND pf.value = TRUE LIMIT 1)
    ) as active_flag_id
    FROM params
),
-- Suggestion IDs for each resource type (filtered by user departments where applicable)
name_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
         FROM (
             SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
             FROM persona_names_junction pn
             JOIN names_resource n ON n.id = pn.name_id
             CROSS JOIN params p
             WHERE pn.name_id IS NOT NULL
               AND n.name IS NOT NULL AND n.name != ''
               AND (
                   pn.generated = false
                   OR (pn.generated = true AND n.generated = true AND EXISTS (
                       SELECT 1 FROM view_calls_entry c
                       JOIN view_runs_entry r ON r.id = c.run_id
                       WHERE c.id IN (SELECT call_id FROM names_calls_connection WHERE names_id = n.id)
                         AND r.group_id = p.group_id
                   ))
               )
             GROUP BY pn.name_id
             ORDER BY MAX(pn.created_at) DESC
             LIMIT 20
         ) pn),
        ARRAY[]::uuid[]
    ) as name_suggestions
    FROM params
    LIMIT 1
),
description_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pd.description_id ORDER BY pd.created_at DESC)
         FROM (
             SELECT DISTINCT pd.description_id, MAX(pd.created_at) as created_at
             FROM persona_descriptions_junction pd
             JOIN descriptions_resource d ON d.id = pd.description_id
             CROSS JOIN params p
             WHERE pd.description_id IS NOT NULL
               AND d.description IS NOT NULL AND d.description != ''
               AND (
                   pd.generated = false
                   OR (pd.generated = true AND d.generated = true AND EXISTS (
                       SELECT 1 FROM view_calls_entry c
                       JOIN view_runs_entry r ON r.id = c.run_id
                       WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                         AND r.group_id = p.group_id
                   ))
               )
             GROUP BY pd.description_id
             ORDER BY MAX(pd.created_at) DESC
             LIMIT 20
         ) pd),
        ARRAY[]::uuid[]
    ) as description_suggestions
    FROM params
    LIMIT 1
),
color_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pc.color_id ORDER BY pc.created_at DESC)
         FROM (
             SELECT DISTINCT pc.color_id, MAX(pc.created_at) as created_at
             FROM persona_colors_junction pc
             JOIN colors_resource c ON c.id = pc.color_id
             CROSS JOIN params p
             WHERE pc.color_id IS NOT NULL
               AND (
                   pc.generated = false
                   OR (pc.generated = true AND c.generated = true AND EXISTS (
                       SELECT 1 FROM view_calls_entry c2
                       JOIN view_runs_entry r ON r.id = c2.run_id
                       WHERE c2.id IN (SELECT call_id FROM colors_calls_connection WHERE colors_id = c.id)
                         AND r.group_id = p.group_id
                   ))
               )
             GROUP BY pc.color_id
             ORDER BY MAX(pc.created_at) DESC
             LIMIT 20
         ) pc),
        ARRAY[]::uuid[]
    ) as color_suggestions
    FROM params
    LIMIT 1
),
icon_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pi.icon_id ORDER BY pi.created_at DESC)
         FROM (
             SELECT DISTINCT pi.icon_id, MAX(pi.created_at) as created_at
             FROM persona_icons_junction pi
             JOIN icons_resource i ON i.id = pi.icon_id
             CROSS JOIN params p
             WHERE pi.icon_id IS NOT NULL
               AND (
                   pi.generated = false
                   OR (pi.generated = true AND i.generated = true AND EXISTS (
                       SELECT 1 FROM view_calls_entry c
                       JOIN view_runs_entry r ON r.id = c.run_id
                       WHERE c.id IN (SELECT call_id FROM icons_calls_connection WHERE icons_id = i.id)
                         AND r.group_id = p.group_id
                   ))
               )
             GROUP BY pi.icon_id
             ORDER BY MAX(pi.created_at) DESC
             LIMIT 20
         ) pi),
        ARRAY[]::uuid[]
    ) as icon_suggestions
    FROM params
    LIMIT 1
),
instructions_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pi.instruction_id ORDER BY pi.created_at DESC)
         FROM (
             SELECT DISTINCT pi.instruction_id, MAX(pi.created_at) as created_at
             FROM persona_instructions_junction pi
             JOIN instructions_resource i ON i.id = pi.instruction_id
             CROSS JOIN params p
             WHERE pi.instruction_id IS NOT NULL
               AND i.active = true
               AND i.template IS NOT NULL AND i.template != ''
               AND (
                   pi.generated = false
                   OR (pi.generated = true AND i.generated = true AND EXISTS (
                       SELECT 1 FROM view_calls_entry c
                       JOIN view_runs_entry r ON r.id = c.run_id
                       WHERE c.id IN (SELECT call_id FROM instructions_calls_connection WHERE instructions_id = i.id)
                         AND r.group_id = p.group_id
                   ))
               )
             GROUP BY pi.instruction_id
             ORDER BY MAX(pi.created_at) DESC
             LIMIT 20
         ) pi),
        ARRAY[]::uuid[]
    ) as instructions_suggestions
    FROM params
    LIMIT 1
),
department_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at DESC)
         FROM (
             SELECT DISTINCT pd.department_id, MAX(pd.created_at) as created_at
             FROM persona_departments_junction pd
             JOIN departments_resource d ON d.id = pd.department_id
             CROSS JOIN params p
             WHERE pd.department_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
               -- Filter by user departments
               AND (
                   COALESCE(array_length(p.user_department_ids, 1), 0) = 0
                   OR pd.department_id = ANY(p.user_department_ids)
               )
               AND (pd.active = true OR (pd.generated = true AND d.generated = true))
             GROUP BY pd.department_id
             ORDER BY MAX(pd.created_at) DESC
             LIMIT 20
         ) pd),
        ARRAY[]::uuid[]
    ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Field suggestions - filtered by user departments
field_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at DESC)
         FROM (
             SELECT DISTINCT pf.field_id, MAX(pf.created_at) as created_at
             FROM persona_fields_junction pf
             JOIN field_fields_junction ffj ON ffj.field_id = pf.field_id
             JOIN fields_resource f ON f.id = ffj.fields_id
             CROSS JOIN params p
             WHERE pf.field_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = ffj.field_id AND fl.name = 'field_active' AND ff.value = true)
               -- Filter by user departments OR cross-department fields
               AND (
                   -- User has no departments (superadmin gets cross-department fields only)
                   COALESCE(array_length(p.user_department_ids, 1), 0) = 0
                   OR
                   -- Field is in a department the user has access to
                   EXISTS (
                       SELECT 1 FROM field_departments_junction fd
                       WHERE fd.field_id = ffj.field_id
                         AND fd.active = true
                         AND fd.department_id = ANY(p.user_department_ids)
                   )
                   OR
                   -- Field is cross-department (not in any department)
                   NOT EXISTS (
                       SELECT 1 FROM field_departments_junction fd2
                       WHERE fd2.field_id = ffj.field_id
                         AND fd2.active = true
                   )
               )
               AND (pf.active = true OR (pf.generated = true AND f.generated = true AND EXISTS (
                   SELECT 1 FROM view_calls_entry c
                   JOIN view_runs_entry r ON r.id = c.run_id
                   WHERE c.id IN (SELECT call_id FROM fields_calls_connection WHERE fields_id = f.id)
                     AND r.group_id = p.group_id
               )))
             GROUP BY pf.field_id
             ORDER BY MAX(pf.created_at) DESC
             LIMIT 20
         ) pf),
        ARRAY[]::uuid[]
    ) as field_suggestions
    FROM params
    LIMIT 1
),
-- Get accessible personas for example suggestions (filtered by user departments)
accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM params x
    JOIN personas_resource p ON true
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.active = true
    WHERE x.persona_id IS NOT NULL
      AND (
        -- User has no departments (superadmin)
        COALESCE(array_length(x.user_department_ids, 1), 0) = 0
        OR pd.department_id = ANY(x.user_department_ids)
        OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
      )
),
example_suggestions_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(pe.example_id ORDER BY pe.created_at DESC)
         FROM (
             SELECT DISTINCT pe.example_id, MAX(pe.created_at) as created_at
             FROM persona_examples_junction pe
             JOIN examples_resource e ON e.id = pe.example_id
             JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
             CROSS JOIN params p
             WHERE pe.example_id IS NOT NULL
               AND e.example IS NOT NULL AND e.example != ''
               AND (pe.active = true OR (pe.generated = true AND e.generated = true AND EXISTS (
                   SELECT 1 FROM view_calls_entry c
                   JOIN view_runs_entry r ON r.id = c.run_id
                   WHERE c.id IN (SELECT call_id FROM examples_calls_connection WHERE examples_id = e.id)
                     AND r.group_id = p.group_id
               )))
             GROUP BY pe.example_id
             ORDER BY MAX(pe.created_at) DESC
             LIMIT 20
         ) pe),
        ARRAY[]::uuid[]
    ) as example_suggestions
    FROM params
    LIMIT 1
),
-- Agent IDs for each resource (simplified selection - first eligible agent)
name_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'names'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
description_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'descriptions'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
color_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'colors'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
icon_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'icons'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
instructions_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'instructions'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
flag_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'flags'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
departments_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'departments'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
fields_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'fields'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
examples_agent_data AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (
        SELECT 1 FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        JOIN resource_tools_relation rt ON rt.tool_id = t.id
        WHERE at.agent_id = a.id AND at.active = true
          AND rt.resource = 'examples'::resource_type
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    )
    ORDER BY a.updated_at DESC
    LIMIT 1
),
-- Multi-resource agent IDs (basic, content, general)
basic_agent_data AS (SELECT NULL::uuid as agent_id),
content_agent_data AS (SELECT NULL::uuid as agent_id),
general_agent_data AS (SELECT NULL::uuid as agent_id),
-- Tools existence check
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'colors'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as colors_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'icons'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as icons_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'instructions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as instructions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'fields'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as fields_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'examples'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as examples_has_tools
    FROM params x
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM persona_departments_combined_data) as department_ids,
    (SELECT field_ids FROM persona_fields_combined_data) as field_ids,
    (SELECT example_ids FROM persona_examples_combined_data) as example_ids,

    -- Suggestion IDs
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT color_suggestions FROM color_suggestions_data), ARRAY[]::uuid[]) as color_suggestions,
    COALESCE((SELECT icon_suggestions FROM icon_suggestions_data), ARRAY[]::uuid[]) as icon_suggestions,
    COALESCE((SELECT instructions_suggestions FROM instructions_suggestions_data), ARRAY[]::uuid[]) as instructions_suggestions,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE((SELECT field_suggestions FROM field_suggestions_data), ARRAY[]::uuid[]) as field_suggestions,
    COALESCE((SELECT example_suggestions FROM example_suggestions_data), ARRAY[]::uuid[]) as example_suggestions,

    -- Agent IDs
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    (SELECT agent_id FROM color_agent_data) as color_agent_id,
    (SELECT agent_id FROM icon_agent_data) as icon_agent_id,
    (SELECT agent_id FROM instructions_agent_data) as instructions_agent_id,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    (SELECT agent_id FROM fields_agent_data) as fields_agent_id,
    (SELECT agent_id FROM examples_agent_data) as examples_agent_id,
    (SELECT agent_id FROM basic_agent_data) as basic_agent_id,
    (SELECT agent_id FROM content_agent_data) as content_agent_id,
    (SELECT agent_id FROM general_agent_data) as general_agent_id,

    -- Tools existence
    tec.names_has_tools,
    tec.colors_has_tools,
    tec.icons_has_tools,
    tec.instructions_has_tools,
    tec.departments_has_tools,
    tec.fields_has_tools,
    tec.examples_has_tools
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
