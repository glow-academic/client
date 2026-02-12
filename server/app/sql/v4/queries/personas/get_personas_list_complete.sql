-- Get personas list with permissions and scenario details
-- Resource-first: only touches persona_artifact + persona's own junctions + resource tables
-- No cross-entity artifact tables (scenario_artifact, field_artifact, etc.)
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
    is_inactive boolean,
    num_scenarios int,
    active_scenario_count int,
    total_scenario_links int,
    updated_at timestamptz
);

-- Filter option types simplified: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_list_personas_v4_option_id AS (
    id uuid,
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
    personas types.q_list_personas_v4_persona[],
    scenario_option_ids types.q_list_personas_v4_option_id[],
    field_option_ids types.q_list_personas_v4_option_id[],
    department_option_ids types.q_list_personas_v4_option_id[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Scenario linkage via denormalized scenarios_resource.persona_ids
-- persona_artifact → persona_personas_junction → personas_resource → scenarios_resource WHERE persona_ids @> ARRAY[personas_resource.id]
persona_scenarios AS (
    SELECT
        ppj.persona_id,
        ARRAY_AGG(DISTINCT sr.id) as scenario_ids,
        COUNT(DISTINCT sr.id)::int as num_scenarios
    FROM persona_personas_junction ppj
    JOIN personas_resource pr ON pr.id = ppj.personas_id
    JOIN scenarios_resource sr ON pr.id = ANY(sr.persona_ids)
    GROUP BY ppj.persona_id
),
persona_departments_data AS (
    SELECT
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments_junction pd
    GROUP BY pd.persona_id
),
-- Field linkage via parameter_fields_resource.field_id → fields_resource.id
persona_fields_data AS (
    SELECT
        ppfj.persona_id,
        ARRAY_AGG(DISTINCT fr.id) as field_ids
    FROM persona_parameter_fields_junction ppfj
    JOIN parameter_fields_resource pfr ON pfr.id = ppfj.parameter_field_id
    JOIN fields_resource fr ON fr.id = pfr.field_id
    WHERE ppfj.active = true
    GROUP BY ppfj.persona_id
),
persona_data_base AS (
    SELECT
        p.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = TRUE) as active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(pfd.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(ps.num_scenarios, 0) as num_scenarios,
        -- active_scenario_count and total_scenario_links from inline scenario count
        COALESCE(ps.num_scenarios, 0) as active_scenario_count,
        COALESCE(ps.num_scenarios, 0) as total_scenario_links
    FROM persona_artifact p
    LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN persona_fields_data pfd ON pfd.persona_id = p.id
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1),
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = TRUE),
        p.updated_at,
        pdd.department_ids, ps.scenario_ids, pfd.field_ids, ps.num_scenarios
    HAVING COUNT(pd.persona_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id
    )
),
persona_data AS (
    SELECT pdb.*
    FROM persona_data_base pdb
),
-- Apply server-side filters
filtered_personas AS (
    SELECT pd.*
    FROM persona_data pd
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(pd.persona_name) LIKE '%' || LOWER(search) || '%' OR LOWER(pd.description) LIKE '%' || LOWER(search) || '%')
        -- Scenario filter: persona must be linked to at least one selected scenario (now scenarios_resource.id)
        AND (api_list_personas_v4.scenario_ids IS NULL OR pd.scenario_ids && api_list_personas_v4.scenario_ids)
        -- Field filter: persona must have at least one of the selected fields (now fields_resource.id)
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
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
-- Search filtering also moved to Python for simplicity
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM persona_data
),
scenario_option_data AS (
    SELECT
        sr.id,
        (SELECT COUNT(*) FROM persona_data pd WHERE sr.id = ANY(pd.scenario_ids)) as count
    FROM scenarios_resource sr
    WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids)
),
assigned_field_ids AS (
    SELECT DISTINCT unnest(field_ids) as field_id
    FROM persona_data
    WHERE field_ids IS NOT NULL AND array_length(field_ids, 1) > 0
),
field_option_data AS (
    SELECT
        fr.id,
        (SELECT COUNT(*) FROM persona_data pd WHERE fr.id = ANY(pd.field_ids)) as count
    FROM fields_resource fr
    WHERE fr.id IN (SELECT field_id FROM assigned_field_ids)
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM persona_data) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
)
SELECT
    -- Aggregate paginated personas
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.persona_id, pd.persona_name, pd.description, pd.color, pd.icon,
             pd.department_ids, pd.scenario_ids, pd.field_ids,
             NOT pd.active, pd.num_scenarios,
             pd.active_scenario_count,
             pd.total_scenario_links,
             pd.updated_at
            )::types.q_list_personas_v4_persona
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_personas pd),
        '{}'::types.q_list_personas_v4_persona[]
    ) as personas,
    -- Scenario option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.id, sod.count)::types.q_list_personas_v4_option_id
        ) FROM scenario_option_data sod),
        '{}'::types.q_list_personas_v4_option_id[]
    ) as scenario_option_ids,
    -- Field option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fod.id, fod.count)::types.q_list_personas_v4_option_id
        ) FROM field_option_data fod),
        '{}'::types.q_list_personas_v4_option_id[]
    ) as field_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_personas_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_personas_v4_option_id[]
    ) as department_option_ids,
    -- Total count of filtered personas (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;

