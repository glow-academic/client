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
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
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
    simulations types.q_get_cohort_v4_simulation[]
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
            ELSE EXISTS(SELECT 1 FROM cohort WHERE id = (SELECT cohort_id FROM params))::boolean
        END as cohort_exists
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
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get cohort department data only if cohort_id provided
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id ORDER BY cd.created_at) as department_ids
    FROM params x
    JOIN cohort_departments cd ON cd.cohort_id = x.cohort_id AND cd.active = true
    WHERE x.cohort_id IS NOT NULL
    GROUP BY cd.cohort_id
),
cohort_department_access_check AS (
    SELECT 
        c.id as cohort_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM cohort_departments cd 
                WHERE cd.cohort_id = c.id 
                AND cd.active = true 
                AND cd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM cohort_departments cd2 
                WHERE cd2.cohort_id = c.id 
                AND cd2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN cohorts c ON c.id = x.cohort_id
    CROSS JOIN user_profile up
    WHERE x.cohort_id IS NOT NULL
),
-- Resource data CTEs - query from cohort_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM draft_names dn JOIN names n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cn.name_id FROM cohort_names cn WHERE cn.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_cohort_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM draft_names dn 
                JOIN names n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM cohort_names cn 
                JOIN names n ON cn.name_id = n.id 
                WHERE cn.cohort_id = (SELECT cohort_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cd.description_id FROM cohort_descriptions cd WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_cohort_v4_description_resource FROM draft_descriptions dd JOIN descriptions d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_cohort_v4_description_resource FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1) as cohort_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT cf.flag_id FROM cohort_flags cf JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_cohort_v4_flag_resource FROM draft_flags df JOIN flags f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_cohort_v4_flag_resource FROM cohort_flags cf JOIN flags f ON cf.flag_id = f.id JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = TRUE LIMIT 1) as cohort_flag_resource
    FROM params
),
-- Name suggestions: linked to cohorts OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cn.name_id ORDER BY cn.created_at DESC)
             FROM (
                 SELECT DISTINCT cn.name_id, MAX(cn.created_at) as created_at
                 FROM cohort_names cn
                 JOIN names n ON n.id = cn.name_id
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
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
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
    LIMIT 1
),
-- Description suggestions: linked to cohorts OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cd.description_id ORDER BY cd.created_at DESC)
             FROM (
                 SELECT DISTINCT cd.description_id, MAX(cd.created_at) as created_at
                 FROM cohort_descriptions cd
                 JOIN descriptions d ON d.id = cd.description_id
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
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
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
                JOIN names n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_cohort_v4_name_resource[]
        ) as names
    FROM params
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
                JOIN descriptions d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_cohort_v4_description_resource[]
        ) as descriptions
    FROM params
    LIMIT 1
),
-- Descriptions: linked to cohorts OR same group with generated=true
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions d
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        d.id = (SELECT description_id FROM description_resource_data)
        OR (
            (
                EXISTS (
                    SELECT 1 FROM cohort_descriptions cd
                    WHERE cd.description_id = d.id
                )
                OR
                (
                    d.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls c
                        JOIN message_calls mc ON mc.call_id = c.id
                        JOIN message_runs mr ON mr.message_id = mc.message_id
                        JOIN group_runs gr ON gr.run_id = mr.run_id
                        WHERE c.id = d.call_id
                          AND gr.group_id = dgd.group_id
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
    FROM flags f
    CROSS JOIN params p
    WHERE 
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Department mapping data
department_mapping_data AS (
    SELECT 
        d.department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments d ON (
        EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.department_id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- Department suggestions: linked to cohorts with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(cd.department_id ORDER BY cd.created_at DESC)
             FROM (
                 SELECT DISTINCT cd.department_id, MAX(cd.created_at) as created_at
                 FROM cohort_departments cd
                 JOIN departments d ON d.id = cd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE cd.department_id IS NOT NULL
                   AND EXISTS (
                       SELECT 1 FROM department_flags df
                       JOIN flags fl ON df.flag_id = fl.id
                       WHERE df.department_id = d.id
                         AND fl.name = 'active'
                         AND df.type = 'active'::type_department_flags
                         AND df.value = true
                   )
                   AND (
                       cd.active = true
                       OR
                       (
                           cd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
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
    LIMIT 1
),
-- Simulation mapping data (simplified - will expand later)
simulation_mapping_data AS (
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        COALESCE(s.generated, false) as generated
    FROM params x
    JOIN simulations s ON EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE (
        sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
    )
),
-- Cohort simulation IDs
cohort_simulation_ids AS (
    SELECT cs.simulation_id
    FROM params x
    JOIN cohort_simulations cs ON cs.cohort_id = x.cohort_id AND cs.active = true
    WHERE x.cohort_id IS NOT NULL
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
),
-- Tools existence check (simplified - will expand later)
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND t.active = true
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND t.active = true
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND t.active = true
        ) as departments_has_tools
    FROM params x
),
-- Permissions (simplified - will expand later)
permissions_final AS (
    SELECT 
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    ELSE true
                END
            ELSE
                CASE 
                    WHEN cdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as can_edit,
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                NULL::text
            ELSE
                CASE 
                    WHEN cdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default cohort that cannot be edited.'::text
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This cohort cannot be edited.'::text
                END
        END as disabled_reason
    FROM params x
    CROSS JOIN user_profile up
    LEFT JOIN cohort_departments_data cdd ON true
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT cohort_exists FROM cohort_exists_check) as cohort_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    NULL::uuid as name_agent_id,  -- TODO: Add agent selection
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_cohort_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.cohort_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    uf.show_description,
    NULL::uuid as description_agent_id,  -- TODO: Add agent selection
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
    uf.show_flag,
    NULL::uuid as flag_agent_id,  -- TODO: Add agent selection
    false as flag_required,
    -- Multi-select resources: departments
    COALESCE(
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                ARRAY[]::uuid[]
            ELSE cdd.department_ids
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_cohort_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT cohort_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE cdd.department_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_cohort_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    NULL::uuid as departments_agent_id,  -- TODO: Add agent selection
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_cohort_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_cohort_v4_department[]
    ) as departments,
    -- Multi-select resources: simulations
    COALESCE(
        CASE 
            WHEN (SELECT cohort_id FROM params) IS NULL THEN
                ARRAY[]::uuid[]
            ELSE (SELECT ARRAY_AGG(simulation_id) FROM cohort_simulation_ids)
        END,
        ARRAY[]::uuid[]
    ) as simulation_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.generated)::types.q_get_cohort_v4_simulation
            ORDER BY smd.name
        )
        FROM simulation_mapping_data smd
        WHERE smd.simulation_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT cohort_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE (SELECT ARRAY_AGG(simulation_id) FROM cohort_simulation_ids)
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_cohort_v4_simulation[]
    ) as simulation_resources,
    uf.show_simulations,
    NULL::uuid as simulations_agent_id,  -- TODO: Add agent selection
    false as simulations_required,
    ARRAY[]::uuid[] as simulation_suggestions,  -- TODO: Add simulation suggestions
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.generated)::types.q_get_cohort_v4_simulation
            ORDER BY smd.name
        ) FROM (SELECT DISTINCT simulation_id, name, description, time_limit, generated FROM simulation_mapping_data) smd),
        '{}'::types.q_get_cohort_v4_simulation[]
    ) as simulations
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN cohort_departments_data cdd ON true
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN department_suggestions_data dsd_dept
$$;
