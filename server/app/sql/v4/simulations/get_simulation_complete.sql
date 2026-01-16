-- Unified get simulation function - handles both new (simulation_id = NULL) and detail (simulation_id provided)
-- Converted to function with composite types following RETURN_STRUCTURE_GUIDELINES.md
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
DROP TYPE IF EXISTS types.q_get_simulation_v4_rubric_grade_agent;
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
DROP TYPE IF EXISTS types.q_get_simulation_v4_scenario_rubric_grade_agent_resource;

-- 3) Recreate types
-- Create resource types first (following RETURN_STRUCTURE_GUIDELINES.md)
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

CREATE TYPE types.q_get_simulation_v4_scenario_rubric_grade_agent_resource AS (
    id uuid,
    rubric_id uuid,
    grade_agent_id uuid,
    agent_id uuid,
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

-- Create rubric_grade_agent type (used by scenario type)
CREATE TYPE types.q_get_simulation_v4_rubric_grade_agent AS (
    rubric_grade_agent_id uuid,
    rubric_id uuid,
    rubric_name text,
    grade_agent_id uuid,
    grade_agent_name text,
    audio_agent_id uuid,
    audio_agent_name text
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
    has_active_video boolean,
    rubric_grade_agents types.q_get_simulation_v4_rubric_grade_agent[]
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
    -- Required fields (first 5) - following RETURN_STRUCTURE_GUIDELINES.md
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
    -- Multi-select resources: scenario_rubric_grade_agents
    scenario_rubric_grade_agent_ids uuid[],
    scenario_rubric_grade_agent_resources types.q_get_simulation_v4_scenario_rubric_grade_agent_resource[],
    show_scenario_rubric_grade_agents boolean,
    scenario_rubric_grade_agents_agent_id uuid,
    scenario_rubric_grade_agents_required boolean,
    scenario_rubric_grade_agent_suggestions uuid[],
    scenario_rubric_grade_agents types.q_get_simulation_v4_scenario_rubric_grade_agent_resource[],
    -- Multi-resource combination agent IDs
    general_agent_id uuid,
    -- Simulation fields (keep existing complex resources)
    simulation_id uuid,
    time_limit int,
    rubric_id uuid,
    valid_rubric_ids uuid[],
    simulation_scenario_artifact_ids uuid[],  -- Renamed from scenario_ids to avoid conflict with resource field
    valid_scenario_ids uuid[],
    video_ids uuid[],
    valid_video_ids uuid[],
    practice_simulation boolean,
    member_agent_id uuid,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    cohort_count bigint,
    primary_department_id uuid,
    valid_department_ids uuid[],
    simulation_scenarios types.q_get_simulation_v4_scenario[],  -- Renamed FROM scenarios_resource to avoid conflict with resource field
    videos types.q_get_simulation_v4_video[],
    parameters types.q_get_simulation_v4_parameter_item[],
    parameter_items types.q_get_simulation_v4_parameter_item_detail[],
    scenarios_full types.q_get_simulation_v4_scenario_full[],
    rubrics types.q_get_simulation_v4_rubric[],
    parameters_full types.q_get_simulation_v4_parameter[],
    fields types.q_get_simulation_v4_field[],
    agents types.q_get_simulation_v4_agent[],
    valid_agent_ids uuid[],
    draft_version int,
    scenario_active_states jsonb,
    scenario_settings jsonb
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
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version,
        ARRAY[]::uuid[] as draft_scenario_ids
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
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
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
            ELSE (SELECT rga.rubric_id FROM simulation_scenarios ss 
             JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
             JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
             JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
             WHERE ss.simulation_id = x.simulation_id 
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                   AND ssf.scenario_id = ss.scenario_id 
                   AND f.name = 'active' 
                   AND ssf.value = true)
             ORDER BY (SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
             LIMIT 1)
        END as rubric_id,
        CASE 
            WHEN x.simulation_id IS NULL THEN 0::int
            ELSE COALESCE(
                (SELECT SUM(stl.time_limit_seconds)
                 FROM scenario_time_limits stl
                 JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                 WHERE stl.simulation_id = x.simulation_id 
                   AND stl.active = true 
                   AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                       AND ssf.scenario_id = ss.scenario_id 
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
    SELECT ARRAY_AGG(d.id) as ids
    FROM department_artifact d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
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
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'active'), false) as active,
        ((SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) = 1) as default_scenario,
        (SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) as position,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'hints_enabled'), false) as hints_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'copy_paste_allowed'), false) as copy_paste_allowed,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'audio_enabled'), false) as audio_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND ssf.scenario_id = ss.scenario_id 
            AND f.name = 'text_enabled'), true) as text_enabled,
        stl.time_limit_seconds,
        COALESCE(
            (SELECT ARRAY_AGG(DISTINCT sf.field_id)
             FROM scenario_fields sf
             WHERE sf.scenario_id = s.id AND sf.active = true),
            ARRAY[]::uuid[]
        ) as parameter_item_ids
    FROM params x
    JOIN simulation_scenarios ss ON ss.simulation_id = x.simulation_id
    JOIN scenarios_resource s ON s.id = ss.scenario_id
    LEFT JOIN scenario_time_limits stl ON stl.simulation_id = ss.simulation_id AND stl.scenario_id = ss.scenario_id AND stl.active = true
    WHERE x.simulation_id IS NOT NULL
    ORDER BY (SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
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
scenario_rubric_grade_agents_data AS (
    SELECT 
        sssrga.scenario_id,
        ARRAY_AGG(
            (srga.id, rga.rubric_id, (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), 
             rga.grade_agent_id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a_text.id LIMIT 1),
             rgav.audio_agent_id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a_voice.id LIMIT 1))::types.q_get_simulation_v4_rubric_grade_agent
            ORDER BY (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
        ) as rubric_grade_agents
    FROM params x
    JOIN simulation_scenarios_base ssb ON ssb.simulation_id = x.simulation_id
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ssb.simulation_id AND sssrga.scenario_id = ssb.scenario_id
    JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    JOIN rubrics_resource r ON r.id = rga.rubric_id
    JOIN agents_resource a_text ON a_text.id = rga.grade_agent_id
    LEFT JOIN rubric_grade_agents_audio rgav ON rgav.rubric_grade_agent_id = rga.id
    LEFT JOIN agents_resource a_voice ON a_voice.id = rgav.audio_agent_id
    WHERE x.simulation_id IS NOT NULL
    GROUP BY sssrga.scenario_id
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
             END,
             COALESCE(srgad.rubric_grade_agents, '{}'::types.q_get_simulation_v4_rubric_grade_agent[])
            )::types.q_get_simulation_v4_scenario
            ORDER BY sb.position
        ) as scenarios,
        ARRAY_AGG(sb.scenario_id) as scenario_ids
    FROM params x
    LEFT JOIN simulation_scenarios_base sb ON sb.simulation_id = x.simulation_id
    LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
    LEFT JOIN scenario_rubric_grade_agents_data srgad ON srgad.scenario_id = sb.scenario_id
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
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s2.id LIMIT 1) as name,
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
      AND EXISTS (
        SELECT 1
        FROM rubric_artifacts ra
        WHERE ra.rubric_id = r.id
          AND ra.artifact = CAST('agent' AS artifacts)
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
    LEFT JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga_sb ON sssrga_sb.simulation_id = sb.id
    LEFT JOIN scenario_rubric_grade_agents_resource srga_sb ON srga_sb.id = sssrga_sb.scenario_rubric_grade_agent_id
    LEFT JOIN rubric_grade_agents rga_sb ON rga_sb.id = srga_sb.grade_agent_id
    JOIN rubrics_resource r2 ON r2.id = rga_sb.rubric_id
    WHERE x.simulation_id IS NOT NULL
      AND rga_sb.rubric_id IS NOT NULL 
      AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r2.id AND f.name = 'active' AND rf.value = TRUE)
    UNION
    SELECT DISTINCT
        r3.id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r3.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r3.id LIMIT 1), '') as description
    FROM params x
    JOIN simulation_scenarios_base ssb ON ssb.simulation_id = x.simulation_id
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga_ssb ON sssrga_ssb.simulation_id = ssb.simulation_id AND sssrga_ssb.scenario_id = ssb.scenario_id
    JOIN scenario_rubric_grade_agents_resource srga_ssb ON srga_ssb.id = sssrga_ssb.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga_ssb ON rga_ssb.id = srga_ssb.grade_agent_id
    JOIN rubrics_resource r3 ON r3.id = rga_ssb.rubric_id
    WHERE x.simulation_id IS NOT NULL
      AND rga_ssb.rubric_id IS NOT NULL 
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
            OR vsl.id = ANY((SELECT ids FROM scenario_filter_ids LIMIT 1)::uuid[])
        )
),
user_departments_for_mapping AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1)
    FROM department_artifact d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
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
    LEFT JOIN rubrics_resource r ON EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'active' AND rf.value = true) AND EXISTS (SELECT 1 FROM rubric_artifacts ra WHERE ra.rubric_id = r.id AND ra.artifact = CAST('agent' AS artifacts))
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
-- Department mapping data (filtered: active flag AND user linked) - following RETURN_STRUCTURE_GUIDELINES.md
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated,
        -- Get group_id from resource.call_id → calls → message_calls → message_runs → group_runs
        (
            SELECT gr.group_id
            FROM calls c
            JOIN message_calls mc ON mc.call_id = c.id
            JOIN message_runs mr ON mr.message_id = mc.message_id
            JOIN group_runs gr ON gr.run_id = mr.run_id
            WHERE c.id = d.call_id
            LIMIT 1
        ) as group_id,
        -- Include scenario_ids, rubric_ids, cohort_ids from existing CTEs
        COALESCE(dsci.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dri.rubric_ids, ARRAY[]::uuid[]) as rubric_ids,
        COALESCE(dci.cohort_ids, ARRAY[]::uuid[]) as cohort_ids
    FROM params x
    LEFT JOIN user_context uc ON true
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
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
selected_agents_from_simulation AS (
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), NULL::text as role
    FROM params x
    JOIN simulation_base sb ON sb.id = x.simulation_id
    JOIN agents_resource a ON false
    WHERE x.simulation_id IS NOT NULL AND false
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
      AND false  -- Domain-based agent lookup removed (a_text, da_text, a_voice, da_voice references removed)
    UNION
    -- Get grade agents from junction tables
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), COALESCE(NULL::artifacts::text, '') as role
    FROM params x
    JOIN simulation_base sb ON sb.id = x.simulation_id
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = sb.id
    JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    JOIN agents_resource a ON a.id = rga.grade_agent_id
    
    
    WHERE x.simulation_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    UNION
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), COALESCE(NULL::artifacts::text, '') as role
    FROM params x
    JOIN simulation_base sb ON sb.id = x.simulation_id
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = sb.id
    JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    JOIN rubric_grade_agents_audio rgav ON rgav.rubric_grade_agent_id = rga.id
    JOIN agents_resource a ON a.id = rgav.audio_agent_id
    
    
    WHERE x.simulation_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true)
    UNION
    -- Get rubric agents (member role) from rubric_domains
    -- NOTE: rubric_domains table was removed in migration 249, so this query returns no rows
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), COALESCE(NULL::artifacts::text, '') as role
    FROM params x
    JOIN simulation_base sb ON sb.id = x.simulation_id
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = sb.id
    JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    JOIN rubrics_resource r ON r.id = rga.rubric_id
    JOIN agents_resource a ON false
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
        SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), COALESCE(NULL::artifacts::text, '') as role
        FROM agent_artifact a
        
        
        LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true) 
        AND false  -- Domain-based agent lookup removed (message, grade artifacts no longer exist)
        GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), NULL::artifacts
        HAVING 
            COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
            OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
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
    SELECT DISTINCT a.id
    FROM rubric_artifact r
    JOIN agents_resource a ON false
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true) 
    AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'active' AND rf.value = true)
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
-- Resource CTEs following RETURN_STRUCTURE_GUIDELINES.md
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
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'simulation'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents_sim ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
            ascores.updated_at
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.unmatched_count ASC,
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
-- Calculate can_edit and disabled_reason (following RETURN_STRUCTURE_GUIDELINES.md)
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
    -- Required fields (first 5) - following RETURN_STRUCTURE_GUIDELINES.md
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
    ) as scenario_ids,
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
    -- Multi-select resources: scenario_flags (placeholder - will be implemented)
    ARRAY[]::uuid[] as scenario_flag_ids,
    '{}'::types.q_get_simulation_v4_scenario_flag_resource[] as scenario_flag_resources,
    false as show_scenario_flags,
    NULL::uuid as scenario_flags_agent_id,
    false as scenario_flags_required,
    ARRAY[]::uuid[] as scenario_flag_suggestions,
    '{}'::types.q_get_simulation_v4_scenario_flag_resource[] as scenario_flags,
    -- Multi-select resources: scenario_positions (placeholder - will be implemented)
    ARRAY[]::uuid[] as scenario_position_ids,
    '{}'::types.q_get_simulation_v4_scenario_position_resource[] as scenario_position_resources,
    false as show_scenario_positions,
    NULL::uuid as scenario_positions_agent_id,
    false as scenario_positions_required,
    ARRAY[]::uuid[] as scenario_position_suggestions,
    '{}'::types.q_get_simulation_v4_scenario_position_resource[] as scenario_positions,
    -- Multi-select resources: scenario_rubric_grade_agents (placeholder - will be implemented)
    ARRAY[]::uuid[] as scenario_rubric_grade_agent_ids,
    '{}'::types.q_get_simulation_v4_scenario_rubric_grade_agent_resource[] as scenario_rubric_grade_agent_resources,
    false as show_scenario_rubric_grade_agents,
    NULL::uuid as scenario_rubric_grade_agents_agent_id,
    false as scenario_rubric_grade_agents_required,
    ARRAY[]::uuid[] as scenario_rubric_grade_agent_suggestions,
    '{}'::types.q_get_simulation_v4_scenario_rubric_grade_agent_resource[] as scenario_rubric_grade_agents,
    -- Multi-resource combination agent IDs
    (SELECT agent_id FROM general_agent_data) as general_agent_id,
    -- Simulation fields (keep existing complex resources)
    COALESCE(sb.id, NULL::uuid) as simulation_id,
    COALESCE(sb.time_limit, 0) as time_limit,
    COALESCE(sb.rubric_id, NULL::uuid) as rubric_id,
    COALESCE(rd.rubric_ids::uuid[], ARRAY[]::uuid[]) as valid_rubric_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'scenarioIds' IS NOT NULL AND jsonb_typeof(payload->'scenarioIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'scenarioIds'))::uuid[]
                WHEN payload->'scenario_ids' IS NOT NULL AND jsonb_typeof(payload->'scenario_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'scenario_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(sd.scenario_ids::uuid[], ARRAY[]::uuid[]),
        ARRAY[]::uuid[]
    ) as simulation_scenario_artifact_ids,  -- Renamed to avoid conflict with resource field
    COALESCE(vs.ids::uuid[], ARRAY[]::uuid[]) as valid_scenario_ids,
    ARRAY[]::uuid[] as video_ids,
    COALESCE(vv.ids::uuid[], ARRAY[]::uuid[]) as valid_video_ids,
    COALESCE(
        (SELECT (payload->>'practiceSimulation')::boolean FROM draft_payload_data),
        (SELECT (payload->>'practice_simulation')::boolean FROM draft_payload_data),
        sb.practice_simulation,
        COALESCE(
            (SELECT (payload->>'practiceSimulation')::boolean FROM draft_payload_data),
            (SELECT (payload->>'practice_simulation')::boolean FROM draft_payload_data),
            false
        )
    ) as practice_simulation,
    -- Auto-select member agent: draft payload -> default from SQL (if only one option) -> NULL
    COALESCE(
        (SELECT (payload->>'member_agent_id')::uuid FROM draft_payload_data),
        (SELECT id FROM default_member_agent),
        NULL::uuid
    ) as member_agent_id,
    CASE 
        WHEN COALESCE(uc.role, 'guest'::profile_role) IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_duplicate,
    CASE 
        WHEN (SELECT simulation_id FROM params) IS NULL THEN false
        WHEN COALESCE((SELECT department_ids FROM simulation_base LIMIT 1), NULL) IS NULL AND COALESCE(uc.role, 'guest'::profile_role) != 'superadmin' THEN false
        WHEN COALESCE(sb.practice_simulation, false) = true THEN false
        WHEN COALESCE(cu.total_cohort_links, 0) > 0 THEN false
        WHEN COALESCE(uc.role, 'guest'::profile_role) IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN (SELECT simulation_id FROM params) IS NULL THEN false
        WHEN COALESCE(cu.total_cohort_links, 0) > 0 THEN true 
        ELSE false 
    END as in_use,
    COALESCE(cu.total_cohort_links, 0) as cohort_count,
    pdi.department_id as primary_department_id,
    COALESCE(dd.department_ids::uuid[], ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(sd.scenarios, ARRAY[]::types.q_get_simulation_v4_scenario[]) as simulation_scenarios,  -- Renamed to avoid conflict with resource field
    COALESCE(vd.videos, ARRAY[]::types.q_get_simulation_v4_video[]) as videos,
    COALESCE(pild.parameter_items, ARRAY[]::types.q_get_simulation_v4_parameter_item[]) as parameters,
    COALESCE(pild.parameter_item_details, ARRAY[]::types.q_get_simulation_v4_parameter_item_detail[]) as parameter_items,
    COALESCE(sfd.scenarios_full, ARRAY[]::types.q_get_simulation_v4_scenario_full[]) as scenarios_full,
    COALESCE(rd.rubrics, ARRAY[]::types.q_get_simulation_v4_rubric[]) as rubrics,
    COALESCE(pfd.parameters, ARRAY[]::types.q_get_simulation_v4_parameter[]) as parameters_full,
    COALESCE(fd.fields, ARRAY[]::types.q_get_simulation_v4_field[]) as fields,
    COALESCE(ad.agents, ARRAY[]::types.q_get_simulation_v4_agent[]) as agents,
    COALESCE(NULL::uuid[], ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract scenarioActiveStates and scenarioSettings from draft payload if available
    COALESCE(
        (SELECT payload->'scenarioActiveStates' FROM draft_payload_data),
        (SELECT payload->'scenario_active_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as scenario_active_states,
    COALESCE(
        (SELECT payload->'scenarioSettings' FROM draft_payload_data),
        (SELECT payload->'scenario_settings' FROM draft_payload_data),
        '{}'::jsonb
    ) as scenario_settings
FROM params p
LEFT JOIN user_context uc ON true
LEFT JOIN permissions_final perm_final ON true
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN simulation_exists_check sec
CROSS JOIN draft_group_data dgd
CROSS JOIN cohort_usage cu
CROSS JOIN valid_scenarios vs
CROSS JOIN valid_videos vv
CROSS JOIN rubrics_data rd
CROSS JOIN parameters_full_data pfd
CROSS JOIN fields_data fd
CROSS JOIN parameter_items_list_data pild
CROSS JOIN scenarios_full_data sfd
CROSS JOIN departments_data dd
CROSS JOIN agents_data ad
CROSS JOIN videos_data vd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
LEFT JOIN simulation_base sb ON sb.id = (SELECT simulation_id FROM params)
LEFT JOIN scenarios_data sd ON sd.scenarios IS NOT NULL AND (SELECT simulation_id FROM params) IS NOT NULL
LEFT JOIN primary_department_id pdi ON true
$$;
