-- Unified get simulation function - handles both new (simulation_id = NULL) and detail (simulation_id provided)
-- Converted to function with composite types following ARTIFACT.md
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop scenario_full first (depends on document), then document, then other types
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_full;
DROP TYPE IF EXISTS types.q_get_simulation_v4_document;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario;
DROP TYPE IF EXISTS types.q_get_simulation_v4_parameter_item;
DROP TYPE IF EXISTS types.q_get_simulation_v4_parameter_item_detail;
DROP TYPE IF EXISTS types.q_get_simulation_v4_persona;
DROP TYPE IF EXISTS types.q_get_simulation_v4_field;
DROP TYPE IF EXISTS types.q_get_simulation_v4_rubric;
DROP TYPE IF EXISTS types.q_get_simulation_v4_department;
DROP TYPE IF EXISTS types.q_get_simulation_v4_parameter;
DROP TYPE IF EXISTS types.q_get_simulation_v4_agent;
DROP TYPE IF EXISTS types.q_get_simulation_v4_video;
-- Drop resource types (will be recreated)
DROP TYPE IF EXISTS types.q_get_simulation_v4_name_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_description_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_flag_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_name_option;
DROP TYPE IF EXISTS types.q_get_simulation_v4_description_option;
DROP TYPE IF EXISTS types.q_get_simulation_v4_flag_option;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_flag_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_position_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_rubric_resource;
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_time_limit_resource;

-- 3) Recreate types
-- Create resource types first (following ARTIFACT.md)
CREATE TYPE types.q_get_simulation_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_name_option AS (
    id uuid,
    name text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_description_option AS (
    id uuid,
    description text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_flag_option AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean,
    group_id uuid
);

-- Scenario resource types
CREATE TYPE types.q_get_simulation_v4_scenario_resource AS (
    id uuid,
    scenario_id uuid,
    name text,
    description text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_scenario_flag_resource AS (
    id uuid,
    scenario_id uuid,
    flag_id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_scenario_position_resource AS (
    simulation_id uuid,
    scenario_id uuid,
    value integer,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_scenario_rubric_resource AS (
    id uuid,
    scenario_id uuid,
    rubric_id uuid,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_simulation_v4_scenario_time_limit_resource AS (
    id uuid,
    scenario_id uuid,
    time_limit_seconds integer,
    generated boolean,
    group_id uuid
);

-- UPDATE department_artifact type to include generated and group_id
DROP TYPE IF EXISTS types.q_get_simulation_v4_department;
CREATE TYPE types.q_get_simulation_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean,
    group_id uuid,
    scenario_ids uuid[],
    rubric_ids uuid[],
    cohort_ids uuid[]
);

CREATE TYPE types.q_get_simulation_v4_scenario AS (
    scenario_id uuid,
    title text,
    description text,
    active boolean,
    position int,
    parameter_item_ids uuid[],
    hints_enabled boolean,
    copy_paste_allowed boolean,
    audio_enabled boolean,
    text_enabled boolean,
    time_limit_seconds int,
    usage_count int,
    success_rate int,
    last_used timestamptz,
    can_remove boolean,
    has_active_video boolean
);

CREATE TYPE types.q_get_simulation_v4_parameter_item AS (
    id uuid,
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_v4_parameter_item_detail AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.q_get_simulation_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_get_simulation_v4_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_simulation_v4_scenario_full AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    persona_mapping types.q_get_simulation_v4_persona[],
    document_mapping types.q_get_simulation_v4_document[],
    parameter_item_mapping types.q_get_simulation_v4_field[],
    parameter_item_ids uuid[],
    document_ids uuid[]
);

CREATE TYPE types.q_get_simulation_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

-- Department type already created above with generated and group_id fields

CREATE TYPE types.q_get_simulation_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_simulation_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_simulation_v4_video AS (
    video_id uuid,
    name text,
    description text,
    length_seconds int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_v4(
    profile_id uuid,
    simulation_id uuid DEFAULT NULL,  -- NULL = new mode, UUID = detail mode
    draft_id uuid DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    scenario_show_selected boolean DEFAULT NULL,
    filter_scenario_ids uuid[] DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5) - following ARTIFACT.md
    actor_name text,
    simulation_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_simulation_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_simulation_v4_name_option[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_simulation_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_simulation_v4_description_option[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_simulation_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_simulation_v4_department[],
    -- Single-select resources: flag (active)
    active_flag_id uuid,
    flag_resource types.q_get_simulation_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_simulation_v4_flag_option[],
    -- Multi-select resources: scenarios
    scenario_ids uuid[],
    scenario_resources types.q_get_simulation_v4_scenario_resource[],
    show_scenarios boolean,
    scenarios_agent_id uuid,
    scenarios_required boolean,
    scenario_suggestions uuid[],
    scenarios types.q_get_simulation_v4_scenario_resource[],
    -- Multi-select resources: scenario_flags
    scenario_flag_ids uuid[],
    scenario_flag_resources types.q_get_simulation_v4_scenario_flag_resource[],
    show_scenario_flags boolean,
    scenario_flags_agent_id uuid,
    scenario_flags_required boolean,
    scenario_flag_suggestions uuid[],
    scenario_flags types.q_get_simulation_v4_scenario_flag_resource[],
    -- Multi-select resources: scenario_positions
    scenario_position_ids uuid[],
    scenario_position_resources types.q_get_simulation_v4_scenario_position_resource[],
    show_scenario_positions boolean,
    scenario_positions_agent_id uuid,
    scenario_positions_required boolean,
    scenario_position_suggestions uuid[],
    scenario_positions types.q_get_simulation_v4_scenario_position_resource[],
    -- Multi-select resources: scenario_rubrics
    scenario_rubric_ids uuid[],
    scenario_rubric_resources types.q_get_simulation_v4_scenario_rubric_resource[],
    show_scenario_rubrics boolean,
    scenario_rubrics_agent_id uuid,
    scenario_rubrics_required boolean,
    scenario_rubric_suggestions uuid[],
    scenario_rubrics types.q_get_simulation_v4_scenario_rubric_resource[],
    rubrics types.q_get_simulation_v4_rubric[],
    -- Multi-select resources: scenario_time_limits
    scenario_time_limit_ids uuid[],
    scenario_time_limit_resources types.q_get_simulation_v4_scenario_time_limit_resource[],
    show_scenario_time_limits boolean,
    scenario_time_limits_agent_id uuid,
    scenario_time_limits_required boolean,
    scenario_time_limit_suggestions uuid[],
    scenario_time_limits types.q_get_simulation_v4_scenario_time_limit_resource[],
    -- Multi-resource combination agent IDs
    general_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        simulation_id AS simulation_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(NULLIF(scenario_search, ''), NULL) AS scenario_search,
        COALESCE(scenario_show_selected, false) AS scenario_show_selected,
        COALESCE(filter_scenario_ids, ARRAY[]::uuid[]) AS filter_scenario_ids,
        mcp AS mcp
),
-- Conditional: Only check simulation existence if simulation_id provided
simulation_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT simulation_id FROM params) IS NULL THEN false::boolean
            ELSE EXISTS(SELECT 1 FROM simulation_artifact WHERE id = (SELECT simulation_id FROM params))::boolean
        END as simulation_exists
),
draft_scenario_ids_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(ds.scenarios_id ORDER BY ds.created_at), ARRAY[]::uuid[]) as scenario_ids
    FROM params x
    LEFT JOIN draft_scenarios ds ON ds.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version,
        (SELECT scenario_ids FROM draft_scenario_ids_data) as draft_scenario_ids
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            NULL::uuid
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
user_context AS (
    SELECT 
        COALESCE(
            (SELECT r.role FROM profile_roles pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1),
            'guest'::profile_role
        ) as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            ''
        ) as actor_name
    FROM params x
    LEFT JOIN profile_artifact p ON p.id = x.profile_id
),
-- Conditional: Get simulation base data only if simulation_id provided (detail mode)
simulation_departments_data AS (
    SELECT 
        sd.simulation_id,
        ARRAY_AGG(sd.department_id ORDER BY sd.created_at) as department_ids
    FROM params x
    JOIN simulation_departments sd ON sd.simulation_id = x.simulation_id AND sd.active = true
    WHERE x.simulation_id IS NOT NULL
    GROUP BY sd.simulation_id
),
simulation_department_access_check AS (
    SELECT 
        x.simulation_id,
        CASE 
            WHEN COALESCE(uc.role, 'guest'::profile_role) = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM simulation_departments sd 
                WHERE sd.simulation_id = x.simulation_id 
                AND sd.active = true 
                AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM simulation_departments sd2 
                WHERE sd2.simulation_id = x.simulation_id 
                AND sd2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    LEFT JOIN user_context uc ON true
    WHERE x.simulation_id IS NOT NULL
),
simulation_base AS (
    SELECT 
        x.simulation_id as id,
        CASE 
            WHEN x.simulation_id IS NULL THEN NULL::text
            ELSE (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = x.simulation_id LIMIT 1)
        END as title,
        CASE 
            WHEN x.simulation_id IS NULL THEN NULL::text
            ELSE (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = x.simulation_id LIMIT 1)
        END as description,
        CASE 
            WHEN x.simulation_id IS NULL THEN NULL::boolean
            ELSE EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = x.simulation_id AND f.name = 'active' AND sf.value = TRUE)
        END as active,
        CASE 
            WHEN x.simulation_id IS NULL THEN NULL::boolean
            ELSE EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = x.simulation_id AND f.name = 'practice' AND sf.value = TRUE)
        END as practice_simulation,
        CASE 
            WHEN x.simulation_id IS NULL THEN NULL::uuid
            ELSE (SELECT srr.rubric_id FROM simulation_scenarios ss 
             JOIN simulation_scenario_rubrics ssr ON ssr.simulation_id = ss.simulation_id
             JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
             WHERE ss.simulation_id = x.simulation_id 
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                   AND sfr.scenario_id = ss.scenario_id 
                   AND f.name = 'active' 
                   AND ssf.value = true)
             ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
             LIMIT 1)
        END as rubric_id,
        CASE 
            WHEN x.simulation_id IS NULL THEN 0::int
            ELSE COALESCE(
                (SELECT SUM(stlr.time_limit_seconds)
                 FROM simulation_scenario_time_limits sstl
                 JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                 JOIN simulation_scenarios ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                 WHERE sstl.simulation_id = x.simulation_id 
                   AND sstl.active = true 
                   AND stlr.active = true
                   AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                       AND sfr.scenario_id = ss.scenario_id 
                       AND f.name = 'active' 
                       AND ssf.value = true)),
                0
            )
        END as time_limit,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM params x
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = x.simulation_id
    LEFT JOIN simulation_department_access_check sdac ON sdac.simulation_id = x.simulation_id AND sdac.has_access = true
    WHERE (x.simulation_id IS NULL OR sdac.has_access = true)
),
cohort_usage AS (
    SELECT 
        CASE 
            WHEN (SELECT simulation_id FROM params) IS NULL THEN 0::bigint
            ELSE (SELECT COUNT(*) FILTER (WHERE cs.active = true) FROM cohort_simulations cs WHERE cs.simulation_id = (SELECT simulation_id FROM params))
        END as active_cohort_count,
        CASE 
            WHEN (SELECT simulation_id FROM params) IS NULL THEN 0::bigint
            ELSE (SELECT COUNT(*) FROM cohort_simulations cs WHERE cs.simulation_id = (SELECT simulation_id FROM params))
        END as total_cohort_links
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_department_ids AS (
    SELECT ARRAY_AGG(dr.id) as ids
    FROM departments_resource dr
    JOIN department_artifact d ON d.id = dr.department_id
    JOIN params x ON true
    JOIN profile_departments pd ON dr.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
primary_department_id AS (
    SELECT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Conditional: Get simulation scenarios only if simulation_id provided (detail mode)
simulation_scenarios_base AS (
    SELECT 
        ss.simulation_id,
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'active'), false) as active,
        ((SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) = 1) as default_scenario,
        (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'hints_enabled'), false) as hints_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'copy_paste_allowed'), false) as copy_paste_allowed,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'audio_enabled'), false) as audio_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'text_enabled'), true) as text_enabled,
        stlr.time_limit_seconds,
        COALESCE(
            (SELECT ARRAY_AGG(DISTINCT sf.field_id)
             FROM scenario_fields sf
             WHERE sf.scenario_id = s.id AND sf.active = true),
            ARRAY[]::uuid[]
        ) as parameter_item_ids
    FROM params x
    JOIN simulation_scenarios ss ON ss.simulation_id = x.simulation_id
    JOIN scenarios_resource s ON s.id = ss.scenario_id
    LEFT JOIN simulation_scenario_time_limits sstl ON sstl.simulation_id = ss.simulation_id
    LEFT JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id AND stlr.scenario_id = ss.scenario_id AND sstl.active = true AND stlr.active = true
    WHERE x.simulation_id IS NOT NULL
    ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
),
scenario_statistics AS (
    SELECT 
        ss.scenario_id,
        COALESCE(
            (SELECT st.parent_id 
             FROM scenario_tree st 
             WHERE st.child_id = ss.scenario_id 
               AND st.parent_id = st.child_id 
             LIMIT 1),
            ss.scenario_id
        ) as root_scenario_id,
        COUNT(DISTINCT sc.id) as usage_count,
        CASE 
            WHEN COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END) > 0 
            THEN ROUND(
                (COUNT(DISTINCT CASE WHEN sc.completed = true AND scg.passed = true THEN sc.id END)::numeric / 
                 COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END)::numeric) * 100
            )
            ELSE 0 
        END as success_rate,
        MAX(sc.created_at) as last_used_date
    FROM params x
    JOIN simulation_scenarios ss ON ss.simulation_id = x.simulation_id
    LEFT JOIN chats sc ON (
        sc.scenario_id IN (
            SELECT st2.child_id 
            FROM scenario_tree st2 
            WHERE st2.parent_id = COALESCE(
                (SELECT st3.parent_id 
                 FROM scenario_tree st3 
                 WHERE st3.child_id = ss.scenario_id 
                   AND st3.parent_id = st3.child_id),
                ss.scenario_id
            )
        )
        OR sc.scenario_id = ss.scenario_id
    )
    LEFT JOIN grades scg ON EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    LEFT JOIN runs r_detail ON r_detail.id = scg.run_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT c.id AS chat_id
        FROM runs r
        JOIN group_runs gr ON gr.run_id = r.id
        JOIN groups g ON g.id = gr.group_id
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id
        WHERE r.id = r_detail.id AND c.id = sc.id
        LIMIT 1
    ) chat_lookup_detail ON true
    WHERE x.simulation_id IS NOT NULL
    GROUP BY ss.scenario_id
),
scenarios_data AS (
    SELECT 
        ARRAY_AGG(
            (sb.scenario_id, sb.name, sb.description, sb.active, sb.position,
             sb.parameter_item_ids, sb.hints_enabled, sb.copy_paste_allowed,
             sb.audio_enabled, sb.text_enabled, sb.time_limit_seconds,
             COALESCE(stats.usage_count, 0), COALESCE(stats.success_rate, 0),
             stats.last_used_date, COALESCE(stats.usage_count, 0) = 0,
             CASE 
                 WHEN sb.scenario_id IS NOT NULL AND EXISTS (
                     SELECT 1 FROM scenario_videos sv 
                     WHERE sv.scenario_id = sb.scenario_id 
                     AND sv.active = true
                 ) THEN true 
                 ELSE false 
             END
            )::types.q_get_simulation_v4_scenario
            ORDER BY sb.position
        ) as scenarios,
        ARRAY_AGG(sb.scenario_id) as scenario_ids
    FROM params x
    LEFT JOIN simulation_scenarios_base sb ON sb.simulation_id = x.simulation_id
    LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
    WHERE x.simulation_id IS NOT NULL
),
valid_scenarios_list AS (
    SELECT DISTINCT
        s.id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description
    FROM scenario_artifact s
    CROSS JOIN user_department_ids udi
    JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
      AND (
          sd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
      )
    UNION
    SELECT DISTINCT
        COALESCE(
            (SELECT st2.parent_id 
             FROM scenario_tree st2 
             WHERE st2.child_id = ssb.scenario_id 
               AND st2.parent_id = st2.child_id 
             LIMIT 1),
            ssb.scenario_id
        ) as id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s2.scenario_id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s2.id LIMIT 1), '') as description
    FROM params x
    JOIN simulation_scenarios_base ssb ON ssb.simulation_id = x.simulation_id
    JOIN scenarios_resource s2 ON s2.id = COALESCE(
        (SELECT st3.parent_id 
         FROM scenario_tree st3 
         WHERE st3.child_id = ssb.scenario_id 
           AND st3.parent_id = st3.child_id 
         LIMIT 1),
        ssb.scenario_id
    )
    WHERE x.simulation_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s2.id AND f.name = 'active' AND sf.value = TRUE)
),
valid_scenarios AS (
    SELECT ARRAY_AGG(id::text) as ids
    FROM valid_scenarios_list
),
valid_videos_list AS (
    SELECT DISTINCT
        v.id,
        v.name,
        v.length_seconds
    FROM videos_resource v
    JOIN scenario_videos sv ON sv.video_id = v.id AND sv.active = true
    JOIN valid_scenarios_list vsl ON vsl.id = sv.scenario_id
    WHERE v.active = true
),
valid_videos AS (
    SELECT ARRAY_AGG(id::text) as ids
    FROM valid_videos_list
),
videos_data AS (
    SELECT 
        ARRAY_AGG(
            (vvl.id, vvl.name, ''::text, vvl.length_seconds)::types.q_get_simulation_v4_video
            ORDER BY vvl.name
        ) as videos
    FROM valid_videos_list vvl
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description
    FROM rubric_artifact r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids udi
    WHERE EXISTS (
        SELECT 1
        FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id
        WHERE rf.rubric_id = r.id
          AND f.name = 'active'
          AND rf.value = true
      )
      AND (
        rd.department_id = ANY(udi.ids)
        OR NOT EXISTS (
            SELECT 1
            FROM rubric_departments rd2
            WHERE rd2.rubric_id = r.id
              AND rd2.active = true
        )
      )
    UNION
    SELECT DISTINCT
        r2.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r2.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r2.id LIMIT 1), '') as description
    FROM params x
    JOIN simulation_base sb ON sb.id = x.simulation_id
    LEFT JOIN simulation_scenario_rubrics ssr_sb ON ssr_sb.simulation_id = sb.id
    LEFT JOIN scenario_rubrics_resource srr_sb ON srr_sb.id = ssr_sb.scenario_rubric_id
    JOIN rubrics_resource r2 ON r2.id = srr_sb.rubric_id
    WHERE x.simulation_id IS NOT NULL
      AND srr_sb.rubric_id IS NOT NULL 
      AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r2.id AND f.name = 'active' AND rf.value = TRUE)
    UNION
    SELECT DISTINCT
        r3.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r3.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r3.id LIMIT 1), '') as description
    FROM params x
    JOIN simulation_scenarios_base ssb ON ssb.simulation_id = x.simulation_id
    JOIN simulation_scenario_rubrics ssr_ssb ON ssr_ssb.simulation_id = ssb.simulation_id
    JOIN scenario_rubrics_resource srr_ssb ON srr_ssb.id = ssr_ssb.scenario_rubric_id AND srr_ssb.scenario_id = ssb.scenario_id
    JOIN rubrics_resource r3 ON r3.id = srr_ssb.rubric_id
    WHERE x.simulation_id IS NOT NULL
      AND srr_ssb.rubric_id IS NOT NULL 
      AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r3.id AND f.name = 'active' AND rf.value = TRUE)
),
rubrics_data AS (
    SELECT 
        ARRAY_AGG(
            (vr.id, vr.name, vr.description)::types.q_get_simulation_v4_rubric
            ORDER BY vr.name
        ) as rubrics,
        ARRAY_AGG(vr.id::text) as rubric_ids
    FROM valid_rubrics_data vr
),
parameters_data AS (
    SELECT DISTINCT
        p.id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = TRUE) as persona_parameter
    FROM parameter_artifact p
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_department_ids udi
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'active' AND pf.value = true)
    GROUP BY p.id, (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = TRUE)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(udi.ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields_resource f2 ON f2.id = fd2.field_id 
                      WHERE (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f2.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags_resource fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'active' AND ff2.value = TRUE) AND fd2.active = true)
),
parameters_full_data AS (
    SELECT 
        ARRAY_AGG(
            (pd.id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter)::types.q_get_simulation_v4_parameter
            ORDER BY pd.name
        ) as parameters
    FROM parameters_data pd
),
parameter_items_data AS (
    SELECT 
        f.id,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as parameter_name
    FROM field_artifact f
    JOIN parameters_resource p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE p.id IN (SELECT id FROM parameters_data)
),
parameter_items_list_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.parameter_id, pid.name, pid.description)::types.q_get_simulation_v4_parameter_item
            ORDER BY pid.name
        ) as parameter_items,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id)::types.q_get_simulation_v4_parameter_item_detail
            ORDER BY pid.name
        ) as parameter_item_details
    FROM parameter_items_data pid
),
fields_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_v4_field
            ORDER BY pid.name
        ) as fields
    FROM parameter_items_data pid
),
scenario_persona_data AS (
    SELECT 
        sp.scenario_id,
        sp.persona_id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as persona_description,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as persona_color,
        (SELECT i.value FROM persona_icons pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as persona_icon,
        false as image_model
    FROM scenario_personas sp
    JOIN personas_resource p ON p.id = sp.persona_id
    WHERE sp.scenario_id IN (SELECT id FROM valid_scenarios_list)
      AND sp.active = true
),
scenario_persona_mapping AS (
    SELECT 
        spd.scenario_id,
        ARRAY_AGG(
            (spd.persona_id, spd.persona_name, spd.persona_description, spd.persona_color, spd.persona_icon, spd.image_model)::types.q_get_simulation_v4_persona
            ORDER BY spd.persona_name
        ) as personas
    FROM scenario_persona_data spd
    GROUP BY spd.scenario_id
),
scenario_documents_data AS (
    SELECT 
        sd.scenario_id,
        ARRAY_AGG(sd.document_id) as document_ids
    FROM scenario_documents sd
    WHERE sd.scenario_id IN (SELECT id FROM valid_scenarios_list)
      AND sd.active = true
    GROUP BY sd.scenario_id
),
scenario_document_mapping AS (
    SELECT 
        sdd.scenario_id,
        ARRAY_AGG(
            (d.id, (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), ''::text)::types.q_get_simulation_v4_document
            ORDER BY (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)
        ) as documents
    FROM scenario_documents_data sdd
    JOIN documents_resource d ON d.id = ANY(sdd.document_ids)
    GROUP BY sdd.scenario_id
),
scenario_parameter_items_data AS (
    SELECT 
        sf.scenario_id,
        ARRAY_AGG(DISTINCT sf.field_id) as parameter_item_ids
    FROM scenario_fields sf
    WHERE sf.scenario_id IN (SELECT id FROM valid_scenarios_list)
      AND sf.active = true
    GROUP BY sf.scenario_id
),
scenario_field_mapping AS (
    SELECT 
        spid.scenario_id,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_v4_field
            ORDER BY pid.name
        ) as fields
    FROM scenario_parameter_items_data spid
    JOIN parameter_items_data pid ON pid.id = ANY(spid.parameter_item_ids)
    GROUP BY spid.scenario_id
),
scenario_filter_ids AS (
    SELECT 
        CASE 
            WHEN (SELECT scenario_show_selected FROM params LIMIT 1) = true 
                AND (SELECT draft_scenario_ids FROM draft_payload_data LIMIT 1) IS NOT NULL
                AND array_length((SELECT draft_scenario_ids FROM draft_payload_data LIMIT 1), 1) > 0
            THEN (SELECT draft_scenario_ids FROM draft_payload_data LIMIT 1)
            WHEN (SELECT array_length(filter_scenario_ids, 1) FROM params LIMIT 1) > 0
            THEN (SELECT filter_scenario_ids FROM params LIMIT 1)
            ELSE ARRAY[]::uuid[]
        END as ids
),
scenarios_full_data AS (
    SELECT 
        ARRAY_AGG(
            (vsl.id, vsl.name, vsl.description,
             COALESCE(
                 (SELECT ARRAY_AGG(spd.persona_id) FROM scenario_persona_data spd WHERE spd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(spm.personas, ARRAY[]::types.q_get_simulation_v4_persona[]),
             COALESCE(sdm.documents, ARRAY[]::types.q_get_simulation_v4_document[]),
             COALESCE(sfm.fields, ARRAY[]::types.q_get_simulation_v4_field[]),
             COALESCE(
                 (SELECT spid.parameter_item_ids FROM scenario_parameter_items_data spid WHERE spid.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(
                 (SELECT sdd.document_ids FROM scenario_documents_data sdd WHERE sdd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             )
            )::types.q_get_simulation_v4_scenario_full
            ORDER BY vsl.name
        ) as scenarios_full
    FROM valid_scenarios_list vsl
    LEFT JOIN scenario_persona_mapping spm ON spm.scenario_id = vsl.id
    LEFT JOIN scenario_document_mapping sdm ON sdm.scenario_id = vsl.id
    LEFT JOIN scenario_field_mapping sfm ON sfm.scenario_id = vsl.id
    WHERE
        -- Search filter
        (
            (SELECT scenario_search FROM params LIMIT 1) IS NULL
            OR LOWER(vsl.name) LIKE '%' || LOWER((SELECT scenario_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(vsl.description, '')) LIKE '%' || LOWER((SELECT scenario_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter (use scenario_filter_ids which comes from draft payload or filter_scenario_ids param)
        AND (
            (SELECT scenario_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(ids, 1) FROM scenario_filter_ids LIMIT 1) IS NULL
            OR (SELECT array_length(ids, 1) FROM scenario_filter_ids LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM scenario_filter_ids sfi
                WHERE vsl.id = ANY(sfi.ids)
            )
        )
),
user_departments_for_mapping AS (
    SELECT DISTINCT dr.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1)
    FROM departments_resource dr
    JOIN department_artifact d ON d.id = dr.department_id
    JOIN params x ON true
    JOIN profile_departments pd ON dr.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
department_scenario_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::uuid[]) as scenario_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN scenarios_resource s ON EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'active' AND sf.value = true)
    INNER JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE (sd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
    GROUP BY ud.id
),
department_rubric_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT r.id ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::uuid[]) as rubric_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN rubrics_resource r ON EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'active' AND rf.value = true)
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
    GROUP BY ud.id
),
department_cohort_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::uuid[]) as cohort_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN cohort_artifact c ON EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
    GROUP BY ud.id
),
-- Department mapping data (filtered: active flag AND user linked) - following ARTIFACT.md
-- Uses department_artifact as base (consistent with user_departments_for_mapping)
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        COALESCE(dr.generated, false) as generated,
        -- Get group_id from resource.call_id → calls → message_calls → message_runs → group_runs
        (
            SELECT gr.group_id
            FROM departments_resource dr2
            JOIN calls c ON c.id = dr2.call_id
            JOIN message_calls mc ON mc.call_id = c.id
            JOIN message_runs mr ON mr.message_id = mc.message_id
            JOIN group_runs gr ON gr.run_id = mr.run_id
            WHERE dr2.id = d.id
            LIMIT 1
        ) as group_id,
        -- Include scenario_ids, rubric_ids, cohort_ids from existing CTEs
        COALESCE(dsci.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dri.rubric_ids, ARRAY[]::uuid[]) as rubric_ids,
        COALESCE(dci.cohort_ids, ARRAY[]::uuid[]) as cohort_ids
    FROM params x
    LEFT JOIN user_context uc ON true
    JOIN departments_resource dr ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_artifact d JOIN department_flags df ON df.department_id = d.id JOIN flags_resource f ON df.flag_id = f.id WHERE d.id = dr.department_id AND f.name = 'active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = dr.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
    LEFT JOIN department_artifact d ON d.id = dr.department_id
    LEFT JOIN department_scenario_ids dsci ON dsci.department_id = d.id
    LEFT JOIN department_rubric_ids dri ON dri.department_id = d.id
    LEFT JOIN department_cohort_ids dci ON dci.department_id = d.id
),
departments_data AS (
    SELECT 
        ARRAY_AGG(
            (ud.id, ud.name, ud.description,
             COALESCE((SELECT d.generated FROM departments_resource d WHERE d.id = ud.id), false),
             (SELECT gr.group_id FROM departments_resource d JOIN calls c ON c.id = d.call_id JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE d.id = ud.id LIMIT 1),
             COALESCE(dsci.scenario_ids, ARRAY[]::uuid[]),
             COALESCE(dri.rubric_ids, ARRAY[]::uuid[]),
             COALESCE(dci.cohort_ids, ARRAY[]::uuid[])
            )::types.q_get_simulation_v4_department
            ORDER BY ud.name
        ) as departments,
        ARRAY_AGG(DISTINCT ud.id::text) as department_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN department_scenario_ids dsci ON dsci.department_id = ud.id
    LEFT JOIN department_rubric_ids dri ON dri.department_id = ud.id
    LEFT JOIN department_cohort_ids dci ON dci.department_id = ud.id
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true
    )
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources ar ON ar.resource = rt.resource AND ar.artifact = 'simulation'::artifacts
    GROUP BY a.id
),

selected_agents_from_simulation AS (
    SELECT NULL::uuid as id, NULL::text as name, NULL::text as description, NULL::text as role
    FROM params x
    WHERE false  -- Domain-based agent lookup removed (a_text, da_text, a_voice, da_voice references removed)
    UNION
    -- Get grade agents from junction tables
    SELECT NULL::uuid as id, NULL::text as name, NULL::text as description, NULL::text as role
    FROM params x
    WHERE false
    UNION
    SELECT NULL::uuid as id, NULL::text as name, NULL::text as description, NULL::text as role
    FROM params x
    WHERE false
    UNION
    -- Get rubric agents (member role) from rubric_domains
    -- NOTE: rubric_domains table was removed in migration 249, so this query returns no rows
    SELECT NULL::uuid as id, NULL::text as name, NULL::text as description, NULL::text as role
    FROM params x
    WHERE false  -- Disabled: rubric_domains table was removed in migration 249
),
agents_data AS (
    SELECT 
        ARRAY_AGG(
            (filtered_agents.id, filtered_agents.name, COALESCE(filtered_agents.description, ''), ARRAY[filtered_agents.role::text])::types.q_get_simulation_v4_agent
            ORDER BY filtered_agents.name
        ) as agents,
        ARRAY_AGG(filtered_agents.id ORDER BY filtered_agents.name) as agent_ids
    FROM (
        SELECT NULL::uuid as id, NULL::text as name, NULL::text as description, NULL::text as role
        FROM (SELECT 1) x
        WHERE false  -- Domain-based agent lookup removed (message, grade artifacts no longer exist)
        GROUP BY NULL::uuid, NULL::text, NULL::text, NULL::text
        HAVING false
        UNION
        SELECT DISTINCT sas.id, sas.name, sas.description, sas.role
        FROM selected_agents_from_simulation sas
    ) filtered_agents
),
-- Auto-select default agents when there's only one option for each role
valid_hint_agents AS (
    SELECT DISTINCT a.id
    FROM agent_artifact a
    
    
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_simulation_agents AS (
    SELECT DISTINCT a.id
    FROM agent_artifact a
    
    
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_voice_agents AS (
    SELECT DISTINCT a.id
    FROM agent_artifact a
    
    
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_member_agents AS (
    SELECT DISTINCT a.id
    FROM agent_artifact a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    
    
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    UNION
    -- Get rubric agents (member role) from rubric_domains
    -- NOTE: rubric_domains table was removed in migration 249, so this query is disabled
    SELECT DISTINCT NULL::uuid as id
    WHERE false
),
default_hint_agent AS (
    SELECT id FROM valid_hint_agents
    WHERE (SELECT COUNT(*) FROM valid_hint_agents) = 1
    LIMIT 1
),
default_simulation_agent AS (
    SELECT id FROM valid_simulation_agents
    WHERE (SELECT COUNT(*) FROM valid_simulation_agents) = 1
    LIMIT 1
),
default_voice_agent AS (
    SELECT id FROM valid_voice_agents
    WHERE (SELECT COUNT(*) FROM valid_voice_agents) = 1
    LIMIT 1
),
default_member_agent AS (
    SELECT id FROM valid_member_agents
    WHERE (SELECT COUNT(*) FROM valid_member_agents) = 1
    LIMIT 1
),
-- Resource CTEs following ARTIFACT.md
-- Note: department_mapping_data will be defined after department_scenario_ids, etc. CTEs
-- Name resource data
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT sn.name_id FROM simulation_names sn WHERE sn.simulation_id = (SELECT simulation_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false), 
                (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = n.call_id LIMIT 1)
            )::types.q_get_simulation_v4_name_resource
            FROM simulation_names sn
            JOIN names_resource n ON sn.name_id = n.id
            WHERE sn.simulation_id = (SELECT simulation_id FROM params)
            LIMIT 1
        ) as name_resource
    FROM params
),
-- Description resource data
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT sd.description_id FROM simulation_descriptions sd WHERE sd.simulation_id = (SELECT simulation_id FROM params) LIMIT 1),
            NULL::uuid
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false),
                (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = d.call_id LIMIT 1)
            )::types.q_get_simulation_v4_description_resource
            FROM simulation_descriptions sd
            JOIN descriptions_resource d ON sd.description_id = d.id
            WHERE sd.simulation_id = (SELECT simulation_id FROM params)
            LIMIT 1
        ) as description_resource
    FROM params
),
-- Flag resource data (active flag)
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT sf.flag_id FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = (SELECT simulation_id FROM params) AND f.name = 'active' AND sf.value = TRUE LIMIT 1),
            NULL::uuid
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false),
                (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = f.call_id LIMIT 1)
            )::types.q_get_simulation_v4_flag_resource
            FROM simulation_flags sf
            JOIN flags_resource f ON sf.flag_id = f.id
            JOIN flags_resource fl ON sf.flag_id = fl.id
            WHERE sf.simulation_id = (SELECT simulation_id FROM params) AND fl.name = 'active' AND f.name = 'active' AND sf.value = TRUE
            LIMIT 1
        ) as flag_resource
    FROM params
),
-- Name suggestions: linked to simulations OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sn.name_id ORDER BY sn.created_at DESC)
             FROM (
                 SELECT DISTINCT sn.name_id, MAX(sn.created_at) as created_at
                 FROM simulation_names sn
                 JOIN names_resource n ON n.id = sn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to simulations (validated by usage)
                       -- Option 2: OR linked to same group with generated=true
                       sn.generated = false
                       OR
                       (
                           sn.generated = true
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
                 GROUP BY sn.name_id
                 ORDER BY MAX(sn.created_at) DESC
                 LIMIT 20
             ) sn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Description suggestions: linked to simulations OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sd.description_id ORDER BY sd.created_at DESC)
             FROM (
                 SELECT DISTINCT sd.description_id, MAX(sd.created_at) as created_at
                 FROM simulation_descriptions sd
                 JOIN descriptions_resource d ON d.id = sd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to simulations (validated by usage)
                       -- Option 2: OR linked to same group with generated=true
                       sd.generated = false
                       OR
                       (
                           sd.generated = true
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
                 GROUP BY sd.description_id
                 ORDER BY MAX(sd.created_at) DESC
                 LIMIT 20
             ) sd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Department suggestions: linked to simulations with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sd.department_id ORDER BY sd.created_at DESC)
             FROM (
                 SELECT DISTINCT sd.department_id, MAX(sd.created_at) as created_at
                 FROM simulation_departments sd
                 JOIN departments_resource d ON d.id = sd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to simulations with active=true
                       sd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           sd.generated = true
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
                 GROUP BY sd.department_id
                 ORDER BY MAX(sd.created_at) DESC
                 LIMIT 20
             ) sd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Suggested resource objects CTEs
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false), 
                     (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = n.call_id LIMIT 1)
                    )::types.q_get_simulation_v4_name_option
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_simulation_v4_name_option[]
        ) as names
    FROM params
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false),
                     (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = d.call_id LIMIT 1)
                    )::types.q_get_simulation_v4_description_option
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_simulation_v4_description_option[]
        ) as descriptions
    FROM params
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
simulation_department_for_agents AS (
    SELECT sd.department_id
    FROM params p
    JOIN simulation_departments sd ON sd.simulation_id = p.simulation_id AND sd.active = true
    WHERE p.simulation_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.simulation_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM simulation_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents_sim AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
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
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
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
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
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
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'scenarios' resource
scenarios_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'scenarios'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'scenario_flags' resource
scenario_flags_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'scenario_flags'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'scenario_rubrics' resource
scenario_rubrics_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'scenario_rubrics'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'scenario_time_limits' resource
scenario_time_limits_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'scenario_time_limits'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'scenario_positions' resource
scenario_positions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'scenario_positions'::resources
        )
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
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
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Scenario suggestions data
scenario_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(s.id ORDER BY s.created_at DESC)
             FROM (
                 SELECT DISTINCT s.id, MAX(s.created_at) as created_at
                 FROM scenarios_resource s
                 JOIN simulation_scenarios ss ON ss.scenario_id = s.scenario_id
                 CROSS JOIN draft_group_data dgd
                 WHERE s.scenario_id IS NOT NULL
                   AND s.active = true
                   AND (
                       -- Option 1: Linked to simulations (validated by usage)
                       ss.generated = false
                       OR
                       -- Option 2: OR linked to same group with generated=true
                       (
                           s.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = s.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY s.id
                 ORDER BY MAX(s.created_at) DESC
                 LIMIT 20
             ) s),
            ARRAY[]::uuid[]
        ) as scenario_suggestions
    FROM params
    LIMIT 1
),
draft_scenario_flag_ids_data AS (
    SELECT 
        ARRAY_AGG(dsf.scenario_flags_id) as scenario_flag_ids
    FROM params x
    JOIN draft_scenario_flags dsf ON dsf.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
),
draft_scenario_position_ids_data AS (
    SELECT 
        ARRAY_AGG(dsp.scenario_position_id) as scenario_position_ids
    FROM params x
    JOIN draft_scenario_positions dsp ON dsp.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
),
draft_scenario_rubric_ids_data AS (
    SELECT 
        ARRAY_AGG(dsr.scenario_rubric_id) as scenario_rubric_ids
    FROM params x
    JOIN draft_scenario_rubrics dsr ON dsr.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
),
draft_scenario_time_limit_ids_data AS (
    SELECT 
        ARRAY_AGG(dstl.scenario_time_limit_id) as scenario_time_limit_ids
    FROM params x
    JOIN draft_scenario_time_limits dstl ON dstl.draft_id = x.draft_id
    WHERE x.draft_id IS NOT NULL
),
scenario_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(s.id)
             FROM scenarios_resource s
             JOIN simulation_scenarios ss ON ss.scenario_id = s.scenario_id
             WHERE ss.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
               AND s.active = true),
            (SELECT
                CASE
                    WHEN payload->'scenarioIds' IS NOT NULL AND jsonb_typeof(payload->'scenarioIds') = 'array' THEN
                        ARRAY(SELECT jsonb_array_elements_text(payload->'scenarioIds'))::uuid[]
                    WHEN payload->'scenario_ids' IS NOT NULL AND jsonb_typeof(payload->'scenario_ids') = 'array' THEN
                        ARRAY(SELECT jsonb_array_elements_text(payload->'scenario_ids'))::uuid[]
                    ELSE NULL
                END
             FROM draft_payload_data),
            ARRAY[]::uuid[]
        ) as scenario_ids
    FROM params
    LIMIT 1
),
scenario_flag_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT scenario_flag_ids FROM draft_scenario_flag_ids_data),
            (SELECT ARRAY_AGG(DISTINCT ssf.scenario_flag_id ORDER BY ssf.scenario_flag_id)
             FROM simulation_scenario_flags ssf
             WHERE ssf.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
               AND ssf.value = true),
            ARRAY[]::uuid[]
        ) as scenario_flag_ids
    FROM params
    LIMIT 1
),
scenario_flag_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (sfr.id, sfr.scenario_id, sfr.flag_id, f.name, f.description, f.icon_id, COALESCE(sfr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = sfr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_flag_resource
                ORDER BY f.name
            )
            FROM scenario_flags_resource sfr
            JOIN flags_resource f ON f.id = sfr.flag_id
            CROSS JOIN scenario_flag_ids_data sfid
            WHERE sfr.id = ANY(sfid.scenario_flag_ids)),
            '{}'::types.q_get_simulation_v4_scenario_flag_resource[]
        ) as scenario_flag_resources
    FROM params
    LIMIT 1
),
scenario_flag_suggestions_data AS (
    SELECT 
        COALESCE((SELECT scenario_flag_ids FROM scenario_flag_ids_data), ARRAY[]::uuid[]) as scenario_flag_suggestions
    FROM params
    LIMIT 1
),
scenario_flags_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (f.id, NULL::uuid, f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = f.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_flag_resource
                ORDER BY f.name
            )
            FROM flags_resource f
            JOIN artifact_flag_types aft ON f.type = aft.flag_type
            WHERE f.active = true
              AND aft.artifact = 'scenario'::artifacts),
            '{}'::types.q_get_simulation_v4_scenario_flag_resource[]
        ) as scenario_flags
    FROM params
    LIMIT 1
),
scenario_position_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT scenario_position_ids FROM draft_scenario_position_ids_data),
            (SELECT ARRAY_AGG(ssp.scenario_position_id ORDER BY ssp.created_at)
             FROM simulation_scenario_positions ssp
             WHERE ssp.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
               AND ssp.active = true),
            ARRAY[]::uuid[]
        ) as scenario_position_ids
    FROM params
    LIMIT 1
),
scenario_position_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base)), spr.scenario_id, spr.value, COALESCE(spr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = spr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_position_resource
                ORDER BY array_position(spid.scenario_position_ids, spr.id)
            )
            FROM scenario_positions_resource spr
            CROSS JOIN scenario_position_ids_data spid
            WHERE spr.id = ANY(spid.scenario_position_ids)),
            '{}'::types.q_get_simulation_v4_scenario_position_resource[]
        ) as scenario_position_resources
    FROM params
    LIMIT 1
),
scenario_position_suggestions_data AS (
    SELECT 
        COALESCE((SELECT scenario_position_ids FROM scenario_position_ids_data), ARRAY[]::uuid[]) as scenario_position_suggestions
    FROM params
    LIMIT 1
),
scenario_positions_data AS (
    SELECT 
        COALESCE((SELECT scenario_position_resources FROM scenario_position_resources_data), '{}'::types.q_get_simulation_v4_scenario_position_resource[]) as scenario_positions
    FROM params
    LIMIT 1
),
-- Scenario rubrics resource data
scenario_rubric_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT scenario_rubric_ids FROM draft_scenario_rubric_ids_data),
            (SELECT ARRAY_AGG(DISTINCT ssr.scenario_rubric_id ORDER BY ssr.scenario_rubric_id)
             FROM simulation_scenario_rubrics ssr
             WHERE ssr.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
               AND ssr.active = true),
            ARRAY[]::uuid[]
        ) as scenario_rubric_ids
    FROM params
    LIMIT 1
),
scenario_rubric_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (srr.id, srr.scenario_id, srr.rubric_id, COALESCE(srr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = srr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_rubric_resource
                ORDER BY srr.scenario_id, srr.rubric_id
            )
            FROM scenario_rubrics_resource srr
            CROSS JOIN scenario_rubric_ids_data srid
            WHERE srr.id = ANY(srid.scenario_rubric_ids)),
            '{}'::types.q_get_simulation_v4_scenario_rubric_resource[]
        ) as scenario_rubric_resources
    FROM params
    LIMIT 1
),
scenario_rubric_suggestions_data AS (
    SELECT 
        COALESCE((SELECT scenario_rubric_ids FROM scenario_rubric_ids_data), ARRAY[]::uuid[]) as scenario_rubric_suggestions
    FROM params
    LIMIT 1
),
scenario_rubrics_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (srr.id, srr.scenario_id, srr.rubric_id, COALESCE(srr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = srr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_rubric_resource
                ORDER BY srr.scenario_id, srr.rubric_id
            )
            FROM scenario_rubrics_resource srr
            WHERE srr.active = true),
            '{}'::types.q_get_simulation_v4_scenario_rubric_resource[]
        ) as scenario_rubrics
    FROM params
    LIMIT 1
),
-- Scenario time limits resource data
scenario_time_limit_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT scenario_time_limit_ids FROM draft_scenario_time_limit_ids_data),
            (SELECT ARRAY_AGG(DISTINCT sstl.scenario_time_limit_id ORDER BY sstl.scenario_time_limit_id)
             FROM simulation_scenario_time_limits sstl
             WHERE sstl.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
               AND sstl.active = true),
            ARRAY[]::uuid[]
        ) as scenario_time_limit_ids
    FROM params
    LIMIT 1
),
scenario_time_limit_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (stlr.id, stlr.scenario_id, stlr.time_limit_seconds, COALESCE(stlr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = stlr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_time_limit_resource
                ORDER BY stlr.scenario_id, stlr.time_limit_seconds
            )
            FROM scenario_time_limits_resource stlr
            CROSS JOIN scenario_time_limit_ids_data stlid
            WHERE stlr.active = true
              AND stlr.id = ANY(stlid.scenario_time_limit_ids)),
            '{}'::types.q_get_simulation_v4_scenario_time_limit_resource[]
        ) as scenario_time_limit_resources
    FROM params
    LIMIT 1
),
scenario_time_limit_suggestions_data AS (
    SELECT 
        COALESCE((SELECT scenario_time_limit_ids FROM scenario_time_limit_ids_data), ARRAY[]::uuid[]) as scenario_time_limit_suggestions
    FROM params
    LIMIT 1
),
scenario_time_limits_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (stlr.id, stlr.scenario_id, stlr.time_limit_seconds, COALESCE(stlr.generated, false),
                 (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = stlr.call_id LIMIT 1)
                )::types.q_get_simulation_v4_scenario_time_limit_resource
                ORDER BY stlr.scenario_id, stlr.time_limit_seconds
            )
            FROM scenario_time_limits_resource stlr
            WHERE stlr.active = true),
            '{}'::types.q_get_simulation_v4_scenario_time_limit_resource[]
        ) as scenario_time_limits
    FROM params
    LIMIT 1
),
-- Agent selection for 'general' - agent with ALL simulation tools
general_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT false WHERE false
            -- Placeholder condition removed - always false
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_tool_resources AS (
        SELECT 
            ea.agent_id,
            COALESCE(
                ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
                ARRAY[]::text[]
            ) as tool_resources,
            ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        LEFT JOIN resource_tools rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT 
            atr.agent_id,
            atr.tool_resources,
            ARRAY_LENGTH(
                ARRAY(
                    SELECT unnest(atr.tool_resources)
                    EXCEPT
                    SELECT unnest(ARRAY['names', 'descriptions', 'departments', 'flags']::text[])
                ),
                1
            ) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'departments', 'flags']::text[] <@ atr.tool_resources
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = atr.agent_id
                  AND f.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.unmatched_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE NULL::uuid = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ascores.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Check for missing tools on required resources
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'scenarios'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as scenarios_has_tools
    FROM params x
),
-- UI flags
ui_flags AS (
    SELECT 
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        true as show_flag  -- Flag is a boolean toggle that should be shown
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.scenarios_has_tools AND EXISTS (SELECT 1 FROM scenarios_resource s WHERE s.active = true LIMIT 1) THEN 'scenarios' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
-- Calculate can_edit and disabled_reason (following ARTIFACT.md)
permissions_data_with_tools AS (
    SELECT 
        CASE 
            -- New mode: check if user has valid departments
            WHEN (SELECT simulation_id FROM params) IS NULL THEN
                CASE 
                    WHEN COALESCE(uc.role, 'guest'::profile_role) = 'superadmin'::profile_role THEN true
                    WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
                    ELSE false
                END
            -- Detail mode: check department access and role
            ELSE
                CASE 
                    WHEN COALESCE((SELECT department_ids FROM simulation_base LIMIT 1), NULL) IS NULL AND COALESCE(uc.role, 'guest'::profile_role) != 'superadmin' THEN false
                    WHEN COALESCE(uc.role, 'guest'::profile_role) IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            -- New mode: check if user has valid departments
            WHEN (SELECT simulation_id FROM params) IS NULL THEN
                CASE 
                    WHEN COALESCE(uc.role, 'guest'::profile_role) = 'superadmin'::profile_role THEN NULL::text
                    WHEN (SELECT COUNT(*) FROM department_mapping_data) = 0 THEN 'No accessible departments found for user'::text
                    ELSE NULL::text
                END
            -- Detail mode: check department access and role
            ELSE
                CASE 
                    WHEN COALESCE((SELECT department_ids FROM simulation_base LIMIT 1), NULL) IS NULL AND COALESCE(uc.role, 'guest'::profile_role) != 'superadmin' THEN 'No departments assigned to this simulation'::text
                    WHEN COALESCE(uc.role, 'guest'::profile_role) NOT IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 'Insufficient permissions to edit simulation'::text
                    ELSE NULL::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN user_context uc ON true
),
permissions_final AS (
    SELECT 
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
)
SELECT 
    -- Required fields (first 5) - following ARTIFACT.md
    COALESCE(uc.actor_name, '')::text as actor_name,
    (SELECT simulation_exists FROM simulation_exists_check) as simulation_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    nrd.name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_simulation_v4_name_option[]) as names,
    -- Single-select resources: description
    drd.description_id,
    drd.description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_simulation_v4_description_option[]) as descriptions,
    -- Multi-select resources: departments
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::uuid[]
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        sb.department_ids,
        CASE 
            WHEN COALESCE(uc.role, 'guest'::profile_role) = 'superadmin'::profile_role THEN NULL::uuid[]
            ELSE COALESCE(ARRAY[pdi.department_id], ARRAY[]::uuid[])
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated, dmd.group_id, dmd.scenario_ids, dmd.rubric_ids, dmd.cohort_ids)::types.q_get_simulation_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::uuid[]
                        WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                sb.department_ids,
                CASE 
                    WHEN COALESCE(uc.role, 'guest'::profile_role) = 'superadmin'::profile_role THEN NULL::uuid[]
                    ELSE COALESCE(ARRAY[pdi.department_id], ARRAY[]::uuid[])
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_simulation_v4_department[]
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
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated, dmd.group_id, dmd.scenario_ids, dmd.rubric_ids, dmd.cohort_ids)::types.q_get_simulation_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated, group_id, scenario_ids, rubric_ids, cohort_ids FROM department_mapping_data) dmd),
        '{}'::types.q_get_simulation_v4_department[]
    ) as departments,
    -- Single-select resources: flag (active)
    frd.active_flag_id,
    frd.flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false),
             (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = f.call_id LIMIT 1)
            )::types.q_get_simulation_v4_flag_option
            ORDER BY f.name
        ) FROM flags_resource f 
        WHERE EXISTS (
            SELECT 1 FROM simulation_flags sf 
            WHERE sf.flag_id = f.id
        )),
        '{}'::types.q_get_simulation_v4_flag_option[]
    ) as flags,
    -- Multi-select resources: scenarios
    -- Get scenario resource IDs FROM scenarios_resource resource table that match simulation's scenario artifact IDs
    COALESCE((SELECT scenario_ids FROM scenario_ids_data), ARRAY[]::uuid[]) as scenario_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (s.id, s.scenario_id, 
             COALESCE((SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1), ''),
             COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.scenario_id LIMIT 1), ''),
             COALESCE(s.generated, false), 
             (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = s.call_id LIMIT 1))::types.q_get_simulation_v4_scenario_resource
            ORDER BY (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)
        )
        FROM scenarios_resource s
        JOIN simulation_scenarios ss ON ss.scenario_id = s.scenario_id
        WHERE ss.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
          AND s.active = true
          AND s.id = ANY(
            COALESCE(
                (SELECT ARRAY_AGG(s2.id)
                 FROM scenarios_resource s2
                 JOIN simulation_scenarios ss2 ON ss2.scenario_id = s2.scenario_id
                 WHERE ss2.simulation_id = COALESCE((SELECT simulation_id FROM params), (SELECT id FROM simulation_base))
                   AND s2.active = true),
                (SELECT 
                    CASE 
                        WHEN payload->'scenarioIds' IS NOT NULL AND jsonb_typeof(payload->'scenarioIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'scenarioIds'))::uuid[]
                        WHEN payload->'scenario_ids' IS NOT NULL AND jsonb_typeof(payload->'scenario_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'scenario_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                ARRAY[]::uuid[]
            )
          )),
        '{}'::types.q_get_simulation_v4_scenario_resource[]
    ) as scenario_resources,
    CASE 
        WHEN NOT tec.scenarios_has_tools THEN false
        WHEN EXISTS (SELECT 1 FROM scenarios_resource LIMIT 1) THEN true
        ELSE false
    END as show_scenarios,
    (SELECT agent_id FROM scenarios_agent_data LIMIT 1) as scenarios_agent_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM scenarios_resource LIMIT 1) THEN true
        ELSE false
    END as scenarios_required,
    COALESCE((SELECT scenario_suggestions FROM scenario_suggestions_data), ARRAY[]::uuid[]) as scenario_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (s.id, s.scenario_id,
             COALESCE((SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1), ''),
             COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.scenario_id LIMIT 1), ''),
             COALESCE(s.generated, false),
             (SELECT gr.group_id FROM calls c JOIN message_calls mc ON mc.call_id = c.id JOIN message_runs mr ON mr.message_id = mc.message_id JOIN group_runs gr ON gr.run_id = mr.run_id WHERE c.id = s.call_id LIMIT 1))::types.q_get_simulation_v4_scenario_resource
            ORDER BY (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)
        ) FROM scenarios_resource s
        WHERE s.active = true),
        '{}'::types.q_get_simulation_v4_scenario_resource[]
    ) as scenarios,
    -- Multi-select resources: scenario_flags
    COALESCE((SELECT scenario_flag_ids FROM scenario_flag_ids_data), ARRAY[]::uuid[]) as scenario_flag_ids,
    COALESCE((SELECT scenario_flag_resources FROM scenario_flag_resources_data), '{}'::types.q_get_simulation_v4_scenario_flag_resource[]) as scenario_flag_resources,
    CASE 
        WHEN COALESCE(array_length((SELECT scenario_ids FROM scenario_ids_data), 1), 0) > 0 THEN true
        WHEN COALESCE(array_length((SELECT scenario_flag_ids FROM scenario_flag_ids_data), 1), 0) > 0 THEN true
        ELSE false
    END as show_scenario_flags,
    (SELECT agent_id FROM scenario_flags_agent_data) as scenario_flags_agent_id,
    false as scenario_flags_required,
    COALESCE((SELECT scenario_flag_suggestions FROM scenario_flag_suggestions_data), ARRAY[]::uuid[]) as scenario_flag_suggestions,
    COALESCE((SELECT scenario_flags FROM scenario_flags_data), '{}'::types.q_get_simulation_v4_scenario_flag_resource[]) as scenario_flags,
    -- Multi-select resources: scenario_positions
    COALESCE((SELECT scenario_position_ids FROM scenario_position_ids_data), ARRAY[]::uuid[]) as scenario_position_ids,
    COALESCE((SELECT scenario_position_resources FROM scenario_position_resources_data), '{}'::types.q_get_simulation_v4_scenario_position_resource[]) as scenario_position_resources,
    CASE 
        WHEN COALESCE(array_length((SELECT scenario_ids FROM scenario_ids_data), 1), 0) > 0 THEN true
        WHEN COALESCE(array_length((SELECT scenario_position_ids FROM scenario_position_ids_data), 1), 0) > 0 THEN true
        ELSE false
    END as show_scenario_positions,
    (SELECT agent_id FROM scenario_positions_agent_data) as scenario_positions_agent_id,
    false as scenario_positions_required,
    COALESCE((SELECT scenario_position_suggestions FROM scenario_position_suggestions_data), ARRAY[]::uuid[]) as scenario_position_suggestions,
    COALESCE((SELECT scenario_positions FROM scenario_positions_data), '{}'::types.q_get_simulation_v4_scenario_position_resource[]) as scenario_positions,
    -- Multi-select resources: scenario_rubrics
    COALESCE((SELECT scenario_rubric_ids FROM scenario_rubric_ids_data), ARRAY[]::uuid[]) as scenario_rubric_ids,
    COALESCE((SELECT scenario_rubric_resources FROM scenario_rubric_resources_data), '{}'::types.q_get_simulation_v4_scenario_rubric_resource[]) as scenario_rubric_resources,
    CASE 
        WHEN COALESCE(array_length((SELECT scenario_ids FROM scenario_ids_data), 1), 0) > 0 THEN true
        WHEN COALESCE(array_length((SELECT scenario_rubric_ids FROM scenario_rubric_ids_data), 1), 0) > 0 THEN true
        ELSE false
    END as show_scenario_rubrics,
    (SELECT agent_id FROM scenario_rubrics_agent_data) as scenario_rubrics_agent_id,
    false as scenario_rubrics_required,
    COALESCE((SELECT scenario_rubric_suggestions FROM scenario_rubric_suggestions_data), ARRAY[]::uuid[]) as scenario_rubric_suggestions,
    COALESCE((SELECT scenario_rubrics FROM scenario_rubrics_data), '{}'::types.q_get_simulation_v4_scenario_rubric_resource[]) as scenario_rubrics,
    COALESCE((SELECT rubrics FROM rubrics_data), '{}'::types.q_get_simulation_v4_rubric[]) as rubrics,
    -- Multi-select resources: scenario_time_limits
    COALESCE((SELECT scenario_time_limit_ids FROM scenario_time_limit_ids_data), ARRAY[]::uuid[]) as scenario_time_limit_ids,
    COALESCE((SELECT scenario_time_limit_resources FROM scenario_time_limit_resources_data), '{}'::types.q_get_simulation_v4_scenario_time_limit_resource[]) as scenario_time_limit_resources,
    CASE 
        WHEN COALESCE(array_length((SELECT scenario_ids FROM scenario_ids_data), 1), 0) > 0 THEN true
        WHEN COALESCE(array_length((SELECT scenario_time_limit_ids FROM scenario_time_limit_ids_data), 1), 0) > 0 THEN true
        ELSE false
    END as show_scenario_time_limits,
    (SELECT agent_id FROM scenario_time_limits_agent_data) as scenario_time_limits_agent_id,
    false as scenario_time_limits_required,
    COALESCE((SELECT scenario_time_limit_suggestions FROM scenario_time_limit_suggestions_data), ARRAY[]::uuid[]) as scenario_time_limit_suggestions,
    COALESCE((SELECT scenario_time_limits FROM scenario_time_limits_data), '{}'::types.q_get_simulation_v4_scenario_time_limit_resource[]) as scenario_time_limits,
    -- Multi-resource combination agent IDs
    (SELECT agent_id FROM general_agent_data) as general_agent_id
FROM params p
LEFT JOIN user_context uc ON true
LEFT JOIN permissions_final perm_final ON true
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN simulation_exists_check sec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN scenario_flag_ids_data sfid
CROSS JOIN scenario_flag_resources_data sfrrd
CROSS JOIN scenario_flag_suggestions_data sfisd
CROSS JOIN scenario_flags_data sfd_flags
CROSS JOIN scenario_position_ids_data spid
CROSS JOIN scenario_position_resources_data sprd
CROSS JOIN scenario_position_suggestions_data spisd
CROSS JOIN scenario_positions_data spd
CROSS JOIN scenario_rubric_ids_data srid
CROSS JOIN scenario_rubric_resources_data srrd
CROSS JOIN scenario_rubric_suggestions_data srisd
CROSS JOIN scenario_rubrics_data srd
CROSS JOIN scenario_time_limit_ids_data stlid
CROSS JOIN scenario_time_limit_resources_data stlrd
CROSS JOIN scenario_time_limit_suggestions_data stlisd
CROSS JOIN scenario_time_limits_data stld
LEFT JOIN simulation_base sb ON sb.id = (SELECT simulation_id FROM params)
LEFT JOIN primary_department_id pdi ON true
$$;
