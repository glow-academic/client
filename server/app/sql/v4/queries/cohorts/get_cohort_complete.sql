-- Unified get cohort function - handles both new (cohort_id = NULL) and detail (cohort_id provided)
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
        WHERE proname = 'api_get_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_cohort_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_cohort_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_cohort_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_cohort_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_cohort_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_cohort_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit bigint,
    generated boolean
);

CREATE TYPE types.q_get_cohort_v4_simulation_position AS (
    simulation_id uuid,
    value integer,
    generated boolean,
    mcp boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_cohort_v4(
    profile_id uuid,
    cohort_id uuid DEFAULT NULL,
    descriptions_search text DEFAULT NULL,
    simulation_search text DEFAULT NULL,
    simulation_show_selected boolean DEFAULT NULL,
    current_simulation_ids uuid[] DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    cohort_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_cohort_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_cohort_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_cohort_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_cohort_v4_description_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_cohort_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_cohort_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_cohort_v4_department[],
    -- Multi-select resources: simulations
    simulation_ids uuid[],
    simulation_resources types.q_get_cohort_v4_simulation[],
    show_simulations boolean,
    simulations_agent_id uuid,
    simulations_required boolean,
    simulation_suggestions uuid[],
    simulations types.q_get_cohort_v4_simulation[],
    -- Simulation positions (per selected simulation)
    simulation_positions types.q_get_cohort_v4_simulation_position[],
    show_simulation_positions boolean,
    simulation_positions_agent_id uuid,
    simulation_positions_required boolean,
    -- Multi-resource combination agent IDs (after all individual resources)
    basic_agent_id uuid,
    general_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        cohort_id AS cohort_id,
        profile_id AS profile_id,
        descriptions_search AS descriptions_search,
        simulation_search AS simulation_search,
        COALESCE(simulation_show_selected, false) AS simulation_show_selected,
        current_simulation_ids AS current_simulation_ids,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check cohort existence if cohort_id provided
cohort_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM cohort_artifact WHERE id = (SELECT cohort_id FROM params))::boolean
        END as cohort_exists
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Draft departments (from departments_draft table)
draft_departments_data AS (
    SELECT
        COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN departments_draft dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
-- Cohort departments (from cohort_departments_junction)
cohort_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cd.department_id ORDER BY cd.created_at)
                 FROM cohort_departments_junction cd
                 WHERE cd.cohort_id = (SELECT cohort_id FROM params)
                   AND cd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
-- Combined: prefer draft if available, otherwise use cohort junction
cohort_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM cohort_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM cohort_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
cohort_department_access_check AS (
    SELECT 
        c.id as cohort_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_type THEN true
            WHEN EXISTS (
                SELECT 1 FROM cohort_departments_junction cd 
                WHERE cd.cohort_id = c.id 
                AND cd.active = true 
                AND cd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM cohort_departments_junction cd2 
                WHERE cd2.cohort_id = c.id 
                AND cd2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN cohort_artifact c ON c.id = x.cohort_id
    CROSS JOIN user_profile up
    WHERE x.cohort_id IS NOT NULL
),
-- Resource data CTEs - query from cohort_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM names_draft dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cn.name_id FROM cohort_names_junction cn WHERE cn.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_cohort_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_draft dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM cohort_names_junction cn 
                JOIN names_resource n ON cn.name_id = n.id 
                WHERE cn.cohort_id = (SELECT cohort_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
    -- Always return at least one row
    LIMIT 1
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_draft dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cd.description_id FROM cohort_descriptions_junction cd WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_cohort_v4_description_resource FROM descriptions_draft dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_cohort_v4_description_resource FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1) as cohort_description_resource
    FROM params
    -- Always return at least one row
    LIMIT 1
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_draft df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cf.flag_id FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND f.name = 'cohort_active' AND cf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_cohort_v4_flag_resource FROM flags_draft df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_cohort_v4_flag_resource FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND f.name = 'cohort_active' AND cf.value = TRUE LIMIT 1) as cohort_flag_resource
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name suggestions: linked to cohorts OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cn.name_id ORDER BY cn.created_at DESC)
             FROM (
                 SELECT DISTINCT cn.name_id, MAX(cn.created_at) as created_at
                 FROM cohort_names_junction cn
                 JOIN names_resource n ON n.id = cn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE cn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       cn.generated = false
                       OR
                       (
                           cn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = n.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY cn.name_id
                 ORDER BY MAX(cn.created_at) DESC
                 LIMIT 20
             ) cn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to cohorts OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cd.description_id ORDER BY cd.created_at DESC)
             FROM (
                 SELECT DISTINCT cd.description_id, MAX(cd.created_at) as created_at
                 FROM cohort_descriptions_junction cd
                 JOIN descriptions_resource d ON d.id = cd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE cd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       cd.generated = false
                       OR
                       (
                           cd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY cd.description_id
                 ORDER BY MAX(cd.created_at) DESC
                 LIMIT 20
             ) cd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Suggested resource objects CTEs
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_cohort_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_cohort_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_cohort_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_cohort_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Descriptions: linked to cohorts OR same group with generated=true
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions_resource d
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        d.id = (SELECT description_id FROM description_resource_data)
        OR (
            (
                EXISTS (
                    SELECT 1 FROM cohort_descriptions_junction cd
                    WHERE cd.description_id = d.id
                )
                OR
                (
                    d.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls_entry c
                        JOIN messages_entry m ON m.id = c.message_id
                        JOIN runs_entry r ON r.id = m.run_id
                        WHERE c.id = d.call_id
                          AND r.group_id = dgd.group_id
                    )
                )
            )
            AND (p.descriptions_search IS NULL OR p.descriptions_search = '' OR
                 LOWER(d.description) LIKE '%' || LOWER(p.descriptions_search) || '%')
            AND d.description IS NOT NULL
            AND d.description != ''
        )
    ORDER BY d.description
),
-- Flags (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE 
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Department mapping data (only active departments user is linked to)
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- Department suggestions: linked to cohorts with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cd.department_id ORDER BY cd.created_at DESC)
             FROM (
                 SELECT DISTINCT cd.department_id, MAX(cd.created_at) as created_at
                 FROM cohort_departments_junction cd
                 JOIN departments_resource d ON d.id = cd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE cd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       cd.active = true
                       OR
                       (
                           cd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY cd.department_id
                 ORDER BY MAX(cd.created_at) DESC
                 LIMIT 20
             ) cd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Simulation mapping data (filtered: active flag AND user department access)
simulation_mapping_data AS (
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE(
            NULLIF(
                REGEXP_REPLACE(
                    TRIM((SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1)),
                    '^0$|\\s0$',
                    ''
                ),
                ''
            ),
            'No description'
        ) as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        ) as time_limit,
        COALESCE(s.generated, false) as generated
    FROM params x
    JOIN simulation_artifact s ON EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = true)
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE (
        sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
    )
),
-- Cohort simulation IDs (always return at least one row)
draft_simulation_ids_data AS (
    SELECT 
        COALESCE(ARRAY_REMOVE(ARRAY_AGG(ds.simulations_id ORDER BY ds.created_at), NULL), ARRAY[]::uuid[]) as simulation_ids
    FROM params x
    LEFT JOIN simulations_draft ds ON ds.draft_id = x.draft_id
    LIMIT 1
),
cohort_simulation_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_REMOVE(ARRAY_AGG(cs.simulation_id ORDER BY cs.created_at), NULL)
                 FROM cohort_simulations_junction cs
                 WHERE cs.cohort_id = (SELECT cohort_id FROM params)
                   AND cs.active = true),
                ARRAY[]::uuid[]
            )
        END as simulation_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
simulation_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_ids FROM draft_simulation_ids_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM draft_simulation_ids_data)
            WHEN COALESCE(array_length((SELECT simulation_ids FROM cohort_simulation_ids_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM cohort_simulation_ids_data)
            ELSE ARRAY[]::uuid[]
        END as simulation_ids
    FROM params
    LIMIT 1
),
simulation_positions_draft_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (dsp.simulation_id, dsp.value, dsp.generated, dsp.mcp)::types.q_get_cohort_v4_simulation_position
                ORDER BY dsp.value, dsp.simulation_id
            ),
            '{}'::types.q_get_cohort_v4_simulation_position[]
        ) as simulation_positions
    FROM params x
    LEFT JOIN simulation_positions_draft dsp ON dsp.draft_id = x.draft_id
    LIMIT 1
),
cohort_simulation_positions_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN '{}'::types.q_get_cohort_v4_simulation_position[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(
                    (spr.simulation_id, spr.value, spr.generated, spr.mcp)::types.q_get_cohort_v4_simulation_position
                    ORDER BY spr.value, spr.simulation_id
                 )
                 FROM cohort_simulation_positions_junction csp
                 JOIN simulation_positions_resource spr ON spr.id = csp.simulation_position_id
                 WHERE csp.cohort_id = (SELECT cohort_id FROM params)
                   AND csp.active = true),
                '{}'::types.q_get_cohort_v4_simulation_position[]
            )
        END as simulation_positions
    FROM params
    LIMIT 1
),
simulation_positions_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_positions FROM simulation_positions_draft_data), 1), 0) > 0
                THEN (SELECT simulation_positions FROM simulation_positions_draft_data)
            WHEN COALESCE(array_length((SELECT simulation_positions FROM cohort_simulation_positions_data), 1), 0) > 0
                THEN (SELECT simulation_positions FROM cohort_simulation_positions_data)
            ELSE '{}'::types.q_get_cohort_v4_simulation_position[]
        END as simulation_positions
    FROM params
    LIMIT 1
),
-- Simulation suggestions: linked to cohorts with active=true OR same group with generated=true
simulation_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cs.simulation_id ORDER BY cs.created_at DESC)
             FROM (
                 SELECT DISTINCT cs.simulation_id, MAX(cs.created_at) as created_at
                 FROM cohort_simulations_junction cs
                 JOIN simulation_artifact s ON s.id = cs.simulation_id
                 CROSS JOIN draft_group_data dgd
                 WHERE cs.simulation_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = true)
                   AND (
                       -- Option 1: Linked to cohorts with active=true
                       cs.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           cs.generated = true
                           AND EXISTS (
                               SELECT 1 FROM simulations_resource sr
                               JOIN calls_entry c ON c.id = sr.call_id
                               JOIN messages_entry m ON m.id = c.message_id
                               JOIN runs_entry r ON r.id = m.run_id
                               WHERE sr.simulation_id = cs.simulation_id
                                 AND sr.generated = true
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY cs.simulation_id
                 ORDER BY MAX(cs.created_at) DESC
                 LIMIT 20
             ) cs),
            ARRAY[]::uuid[]
        ) as simulation_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        true as show_name,
        true as show_description,
        true as show_flag,
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM simulation_mapping_data) > 0 THEN true
            ELSE false
        END as show_simulations
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Tools existence check
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'simulations'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as simulations_has_tools
    FROM params x
    -- Always return at least one row
    LIMIT 1
),
-- Missing tools check for required resources
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM tools_existence_check tec
    CROSS JOIN ui_flags uf
    -- Always return at least one row
    LIMIT 1
),
-- Selected department for agent selection (use first department from user or cohort)
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT ud.department_id FROM user_departments ud LIMIT 1),
            (SELECT dept_id FROM cohort_departments_data cdd CROSS JOIN LATERAL unnest(cdd.department_ids) as dept_id LIMIT 1)
        ) as department_id
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- User departments for agent selection
user_departments_for_agents AS (
    SELECT department_id FROM user_departments
),
-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['names']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['descriptions']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['descriptions']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['flags']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['flags']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['departments']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['departments']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'simulations' resource
simulations_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'simulations'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['simulations']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['simulations']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'simulation_positions' resource
simulation_positions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'simulation_positions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['simulation_positions']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
                  AND rt2.resource::text <> ALL(ARRAY['simulation_positions']::text[])
            ) as extra_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_required_count < 1 THEN 2
            WHEN adp.extra_artifact_count = 0 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'basic' multi-resource combination (names + descriptions + flags + departments)
basic_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_scores AS (
        SELECT 
            ea.agent_id,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count,
            ea.updated_at
        FROM eligible_agents ea
        -- Filter by MCP flag when mcp=true
        WHERE (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = ea.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.matched_artifact_count,
            ascores.extra_outside_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        WHERE ascores.matched_required_count = 4
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'general' - agent with ALL cohort tools (names, descriptions, flags, departments, simulations)
general_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'cohort'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_scores AS (
        SELECT 
            ea.agent_id,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations']::text[])
            ) as matched_required_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text = ANY(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as matched_artifact_count,
            (
                SELECT COUNT(DISTINCT rt2.resource::text)
                FROM agent_tools_junction at2
                JOIN resource_tools_relation rt2 ON rt2.tool_id = at2.tool_id
                WHERE at2.agent_id = ea.agent_id
                  AND at2.active = true
                  AND rt2.resource::text <> ALL(ARRAY['names', 'descriptions', 'flags', 'departments', 'simulations', 'simulation_positions']::text[])
            ) as extra_outside_count,
            ea.updated_at
        FROM eligible_agents ea
        -- Filter by MCP flag when mcp=true
        WHERE (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = ea.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.matched_artifact_count,
            ascores.extra_outside_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        WHERE ascores.matched_required_count = 5
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Permissions with tool checks
permissions_final AS (
    SELECT 
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                -- New mode: check for missing tools on required resources
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
                    ELSE true
                END
            ELSE
                -- Edit mode: check permissions and missing tools
                CASE 
                    WHEN cdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN
                        CASE 
                            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
                            ELSE true
                        END
                    ELSE false
                END
        END as can_edit,
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                -- New mode: disabled_reason based on missing tools
                CASE 
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                        'No tool configured for ' || array_to_string(mtc.missing_resources, ', ') || '. Therefore we cannot proceed ahead.'::text
                    ELSE NULL::text
                END
            ELSE
                -- Edit mode: disabled_reason based on permissions and missing tools
                CASE 
                    WHEN cdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default cohort that cannot be edited.'::text
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN
                        CASE 
                            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                                'No tool configured for ' || array_to_string(mtc.missing_resources, ', ') || '. Therefore we cannot proceed ahead.'::text
                            ELSE NULL::text
                        END
                    ELSE 
                        'This cohort cannot be edited.'::text
                END
        END as disabled_reason
    FROM params x
    CROSS JOIN user_profile up
    LEFT JOIN cohort_departments_data cdd ON true
    CROSS JOIN missing_tools_check mtc
    -- Always return at least one row
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT cohort_exists FROM cohort_exists_check) as cohort_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_cohort_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.cohort_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.id, dd.description, dd.generated)::types.q_get_cohort_v4_description_resource
            ORDER BY dd.description
        ) FROM (SELECT DISTINCT id, description, generated FROM descriptions_data) dd),
        COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_cohort_v4_description_resource[])
    ) as descriptions,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.cohort_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_flag
    END as show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    -- Multi-select resources: departments
    cdd.department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_cohort_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(COALESCE(cdd.department_ids, ARRAY[]::uuid[]))),
        '{}'::types.q_get_cohort_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    -- Departments array (all available - uses same department_mapping_data CTE)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_cohort_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_cohort_v4_department[]
    ) as departments,
    -- Multi-select resources: simulations
    sid.simulation_ids,
    -- Simulation resources (selected simulations filtered by simulation_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.generated)::types.q_get_cohort_v4_simulation
            ORDER BY smd.name
        )
        FROM simulation_mapping_data smd
        WHERE smd.simulation_id = ANY(COALESCE(sid.simulation_ids, ARRAY[]::uuid[]))),
        '{}'::types.q_get_cohort_v4_simulation[]
    ) as simulation_resources,
    CASE 
        WHEN NOT tec.simulations_has_tools THEN false
        ELSE uf.show_simulations
    END as show_simulations,
    (SELECT agent_id FROM simulations_agent_data) as simulations_agent_id,
    false as simulations_required,
    COALESCE((SELECT simulation_suggestions FROM simulation_suggestions_data), ARRAY[]::uuid[]) as simulation_suggestions,
    -- Simulations array (all available - uses same simulation_mapping_data CTE)
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.generated)::types.q_get_cohort_v4_simulation
            ORDER BY smd.name
        ) FROM (SELECT DISTINCT simulation_id, name, description, time_limit, generated FROM simulation_mapping_data) smd),
        '{}'::types.q_get_cohort_v4_simulation[]
    ) as simulations,
    COALESCE((SELECT simulation_positions FROM simulation_positions_data), '{}'::types.q_get_cohort_v4_simulation_position[]) as simulation_positions,
    CASE
        WHEN COALESCE(array_length((SELECT simulation_positions FROM simulation_positions_data), 1), 0) > 0 THEN true
        ELSE false
    END as show_simulation_positions,
    (SELECT agent_id FROM simulation_positions_agent_data) as simulation_positions_agent_id,
    false as simulation_positions_required,
    -- Multi-resource combination agent IDs (after all individual resources)
    (SELECT agent_id FROM basic_agent_data) as basic_agent_id,
    (SELECT agent_id FROM general_agent_data) as general_agent_id
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN cohort_departments_data cdd
CROSS JOIN simulation_ids_data sid
CROSS JOIN simulation_positions_data spd
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN simulation_suggestions_data ssd
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN missing_tools_check mtc
$$;
