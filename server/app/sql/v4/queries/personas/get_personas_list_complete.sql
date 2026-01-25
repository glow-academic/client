-- Get personas list with permissions and scenario details
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_personas_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_personas_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    department_ids text[],
    scenario_ids uuid[],
    field_ids uuid[],
    agent_id uuid,
    agent_name text,
    model_id uuid,
    model_name text,
    reasoning text,
    temperature float,
    temperature_display text,
    active boolean,
    is_inactive boolean,
    num_scenarios int,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    updated_at timestamptz
);

CREATE TYPE types.q_list_personas_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean,
    persona_ids uuid[],
    document_ids uuid[],
    parameter_item_ids uuid[],
    count bigint
);

CREATE TYPE types.q_list_personas_v4_field AS (
    field_id uuid,
    name text,
    description text,
    count bigint
);

CREATE TYPE types.q_list_personas_v4_department AS (
    department_id uuid,
    name text,
    description text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_personas_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    field_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    actor_name text,
    personas types.q_list_personas_v4_persona[],
    scenarios types.q_list_personas_v4_scenario[],
    fields types.q_list_personas_v4_field[],
    departments types.q_list_personas_v4_department[],
    total_count bigint,
    general_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
persona_scenarios AS (
    SELECT
        ppj.persona_id,
        ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_personas_junction sp
    JOIN personas_resource pr ON pr.id = sp.persona_id
    JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id
    JOIN scenario_tree_junction st ON st.child_id = sp.scenario_id
    WHERE sp.active = true AND st.parent_id = st.child_id
    GROUP BY ppj.persona_id
),
persona_departments_data AS (
    SELECT
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments_junction pd
    GROUP BY pd.persona_id
),
persona_fields_data AS (
    SELECT
        pf.persona_id,
        ARRAY_AGG(DISTINCT ffj.field_id) as field_ids
    FROM persona_fields_junction pf
    JOIN fields_resource fr ON fr.id = pf.field_id
    JOIN field_fields_junction ffj ON ffj.fields_id = fr.id
    WHERE pf.active = true
    GROUP BY pf.persona_id
),
persona_data_base AS (
    SELECT
        p.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        NULL::uuid as agent_id,
        NULL::uuid as model_id,
        NULL::text as reasoning,
        NULL::numeric as temperature,
        EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = TRUE) as active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(pfd.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(ps.num_scenarios, 0) as num_scenarios,
        COALESCE(pes.active_scenario_count, 0) as active_scenario_count,
        COALESCE(pes.total_scenario_links, 0) as total_scenario_links,
        pes.department_ids as perm_dept_ids
    FROM persona_artifact p
    LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
    LEFT JOIN view_persona_edit_state pes ON pes.persona_id = p.id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN persona_fields_data pfd ON pfd.persona_id = p.id
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY p.id, (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1), (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = TRUE), p.updated_at,
             pdd.department_ids, ps.scenario_ids, pfd.field_ids, ps.num_scenarios, pes.active_scenario_count, pes.total_scenario_links, pes.department_ids
    HAVING COUNT(pd.persona_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id
    )
),
persona_data AS (
    SELECT
        pdb.*,
        CASE
            WHEN pdb.active_scenario_count > 0 THEN false
            WHEN pdb.perm_dept_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE
            WHEN pdb.perm_dept_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN pdb.total_scenario_links > 0 THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_delete
    FROM persona_data_base pdb
    CROSS JOIN user_profile up
),
-- Apply server-side filters
filtered_personas AS (
    SELECT pd.*
    FROM persona_data pd
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(pd.persona_name) LIKE '%' || LOWER(search) || '%' OR LOWER(pd.description) LIKE '%' || LOWER(search) || '%')
        -- Scenario filter: persona must be linked to at least one selected scenario
        AND (api_list_personas_v4.scenario_ids IS NULL OR pd.scenario_ids && api_list_personas_v4.scenario_ids)
        -- Field filter: persona must have at least one of the selected fields
        AND (api_list_personas_v4.field_ids IS NULL OR pd.field_ids && api_list_personas_v4.field_ids)
        -- Department filter: persona must belong to at least one selected department
        AND (filter_department_ids IS NULL OR pd.department_ids && filter_department_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_personas
),
-- Paginate filtered results
paginated_personas AS (
    SELECT fp.*
    FROM filtered_personas fp
    ORDER BY fp.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM persona_data
),
scenario_mapping_data AS (
    SELECT
        asi.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = asi.scenario_id LIMIT 1) as name,
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = asi.scenario_id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        ARRAY[]::uuid[] as persona_ids,
        ARRAY[]::uuid[] as document_ids,
        ARRAY[]::uuid[] as parameter_item_ids,
        (SELECT COUNT(*) FROM persona_data pd WHERE asi.scenario_id = ANY(pd.scenario_ids)) as count
    FROM all_scenario_ids asi
    JOIN scenario_artifact sa ON sa.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = asi.scenario_id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
),
-- Filter scenario options by search term
filtered_scenario_options AS (
    SELECT smd.*
    FROM scenario_mapping_data smd
    WHERE scenario_search IS NULL OR smd.name ILIKE '%' || scenario_search || '%'
),
department_mapping_data AS (
    SELECT
        dr.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1), '') as description,
        (SELECT COUNT(*) FROM persona_data) as count
    FROM departments_resource dr
    JOIN department_departments_junction ddj ON ddj.departments_id = dr.id
    WHERE dr.id IN (SELECT department_id FROM user_departments)
),
-- Filter department options by search term
filtered_department_options AS (
    SELECT dmd.*
    FROM department_mapping_data dmd
    WHERE department_search IS NULL OR dmd.name ILIKE '%' || department_search || '%'
),
-- Get all unique field_artifact IDs used by any persona
assigned_field_ids AS (
    SELECT DISTINCT unnest(field_ids) as field_id
    FROM persona_data
    WHERE field_ids IS NOT NULL AND array_length(field_ids, 1) > 0
),
-- Get field names, descriptions, and counts
field_mapping_data AS (
    SELECT
        fa.id as field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = fa.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = fa.id LIMIT 1), '') as description,
        (SELECT COUNT(*) FROM persona_data pd WHERE fa.id = ANY(pd.field_ids)) as count
    FROM field_artifact fa
    WHERE fa.id IN (SELECT field_id FROM assigned_field_ids)
),
-- Filter field options by search term
filtered_field_options AS (
    SELECT fmd.*
    FROM field_mapping_data fmd
    WHERE field_search IS NULL OR fmd.name ILIKE '%' || field_search || '%'
),
-- Find the general agent that can generate personas for this user
general_agent_for_user AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id
                  WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND EXISTS (SELECT 1 FROM agent_tools_junction at2 JOIN tools_resource tr_rt ON tr_rt.id = at2.tool_id
        JOIN tool_tools_junction ttj_rt ON ttj_rt.tools_id = tr_rt.id
        JOIN resource_tools_relation rt ON rt.tool_id = ttj_rt.tool_id
        JOIN artifact_resources_relation ar ON ar.resource = rt.resource
        WHERE at2.agent_id = a.id AND at2.active = TRUE AND ar.artifact = 'persona'::artifact_type)
    AND (EXISTS (SELECT 1 FROM agent_departments_junction ad
                 JOIN user_departments ud ON ad.department_id = ud.department_id
                 WHERE ad.agent_id = a.id AND ad.active = true)
         OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
    AND ARRAY['names','descriptions','colors','icons','instructions',
              'flags','examples','fields','departments']::text[]
        <@ COALESCE(
            (SELECT ARRAY_AGG(DISTINCT rt2.resource::text)
             FROM agent_tools_junction at3
             JOIN tools_resource tr2 ON tr2.id = at3.tool_id
             JOIN tool_tools_junction ttj2 ON ttj2.tools_id = tr2.id
             JOIN tool_artifact t ON t.id = ttj2.tool_id
                  AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f2 ON tf.flag_id = f2.id
                              WHERE tf.tool_id = t.id AND f2.name = 'tool_active' AND tf.value = true)
             JOIN resource_tools_relation rt2 ON rt2.tool_id = t.id
             WHERE at3.agent_id = a.id AND at3.active = true),
            ARRAY[]::text[]
        )
    ORDER BY
        CASE WHEN EXISTS (
            SELECT 1 FROM agent_departments_junction ad
            JOIN user_departments ud ON ad.department_id = ud.department_id
            WHERE ad.agent_id = a.id AND ad.active = true
        ) THEN 0 ELSE 1 END ASC,
        a.updated_at DESC, a.id ASC
    LIMIT 1
)
SELECT
    up.actor_name::text as actor_name,
    -- Aggregate paginated personas
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.persona_id, pd.persona_name, pd.description, pd.color, pd.icon,
             pd.department_ids, pd.scenario_ids, pd.field_ids, pd.agent_id, NULL::text,
             pd.model_id, NULL::text, pd.reasoning,
             COALESCE(pd.temperature, 0.0),
             CASE WHEN pd.temperature IS NOT NULL THEN TO_CHAR(pd.temperature, 'FM0.00') ELSE '0.00' END,
             pd.active, NOT pd.active, pd.num_scenarios,
             pd.can_edit,
             true,
             pd.can_delete,
             pd.updated_at
            )::types.q_list_personas_v4_persona
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_personas pd),
        '{}'::types.q_list_personas_v4_persona[]
    ) as personas,
    -- Aggregate filtered scenario options
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.scenario_id, smd.name, smd.description, smd.active, smd.persona_ids,
             smd.document_ids, smd.parameter_item_ids, smd.count)::types.q_list_personas_v4_scenario
            ORDER BY smd.name
        ) FROM filtered_scenario_options smd),
        '{}'::types.q_list_personas_v4_scenario[]
    ) as scenarios,
    -- Aggregate filtered field options
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.count)::types.q_list_personas_v4_field
            ORDER BY fmd.name
        ) FROM filtered_field_options fmd),
        '{}'::types.q_list_personas_v4_field[]
    ) as fields,
    -- Aggregate filtered department options
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.count)::types.q_list_personas_v4_department
            ORDER BY dmd.name
        ) FROM filtered_department_options dmd),
        '{}'::types.q_list_personas_v4_department[]
    ) as departments,
    -- Total count of filtered personas (before pagination)
    (SELECT total_count FROM filtered_count) as total_count,
    -- General agent ID for generation capability
    (SELECT agent_id FROM general_agent_for_user) as general_agent_id
FROM user_profile up
$$;
