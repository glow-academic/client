-- Get simulation detail with departments, scenarios, and access control
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
        WHERE proname = 'api_get_simulation_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop scenario_full first (depends on document), then document, then other types
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_scenario_full;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_document;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_scenario;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_parameter_item;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_parameter_item_detail;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_persona;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_field;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_rubric;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_rubric_grade_agent;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_department;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_parameter;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v4_agent;

-- 3) Recreate types
-- Create rubric_grade_agent type first (used by scenario type)
CREATE TYPE types.q_get_simulation_detail_v4_rubric_grade_agent AS (
    rubric_grade_agent_id uuid,
    rubric_id uuid,
    rubric_name text,
    grade_agent_id uuid,
    grade_agent_name text,
    audio_agent_id uuid,
    audio_agent_name text
);

CREATE TYPE types.q_get_simulation_detail_v4_scenario AS (
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
    rubric_grade_agents types.q_get_simulation_detail_v4_rubric_grade_agent[]
);

CREATE TYPE types.q_get_simulation_detail_v4_parameter_item AS (
    id uuid,
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v4_parameter_item_detail AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.q_get_simulation_detail_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_get_simulation_detail_v4_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_simulation_detail_v4_scenario_full AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    persona_mapping types.q_get_simulation_detail_v4_persona[],
    document_mapping types.q_get_simulation_detail_v4_document[],
    parameter_item_mapping types.q_get_simulation_detail_v4_field[],
    parameter_item_ids uuid[],
    document_ids uuid[]
);

CREATE TYPE types.q_get_simulation_detail_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v4_department AS (
    department_id uuid,
    name text,
    description text,
    scenario_ids uuid[],
    rubric_ids uuid[],
    cohort_ids uuid[]
);

CREATE TYPE types.q_get_simulation_detail_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_simulation_detail_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_detail_v4(
    simulation_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    scenario_show_selected boolean DEFAULT NULL,
    filter_scenario_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    simulation_exists boolean,
    actor_name text,
    simulation_id uuid,
    name text,
    description text,
    department_ids uuid[],
    valid_department_ids uuid[],
    time_limit int,
    rubric_id uuid,
    valid_rubric_ids uuid[],
    scenario_ids uuid[],
    valid_scenario_ids uuid[],
    active boolean,
    practice_simulation boolean,
    simulation_text_domain_id uuid,
    simulation_voice_domain_id uuid,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    cohort_count bigint,
    scenarios types.q_get_simulation_detail_v4_scenario[],
    parameters types.q_get_simulation_detail_v4_parameter_item[],
    parameter_items types.q_get_simulation_detail_v4_parameter_item_detail[],
    scenarios_full types.q_get_simulation_detail_v4_scenario_full[],
    rubrics types.q_get_simulation_detail_v4_rubric[],
    departments types.q_get_simulation_detail_v4_department[],
    parameters_full types.q_get_simulation_detail_v4_parameter[],
    fields types.q_get_simulation_detail_v4_field[],
    agents types.q_get_simulation_detail_v4_agent[],
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
        COALESCE(filter_scenario_ids, ARRAY[]::uuid[]) AS filter_scenario_ids
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version,
        CASE 
            WHEN d.payload->'scenarioIds' IS NOT NULL AND jsonb_typeof(d.payload->'scenarioIds') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(d.payload->'scenarioIds'))::uuid[]
            WHEN d.payload->'scenario_ids' IS NOT NULL AND jsonb_typeof(d.payload->'scenario_ids') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(d.payload->'scenario_ids'))::uuid[]
            ELSE ARRAY[]::uuid[]
        END as draft_scenario_ids
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'simulations'::draft_resource_type
    LIMIT 1
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
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
user_context AS (
    SELECT 
        role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
simulation_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM simulations WHERE id = (SELECT simulation_id FROM params)
    )::boolean as simulation_exists
),
simulation_departments_data AS (
    SELECT 
        sd.simulation_id,
        ARRAY_AGG(sd.department_id ORDER BY sd.created_at) as department_ids
    FROM simulation_departments sd
    WHERE sd.simulation_id = (SELECT simulation_id FROM params) AND sd.active = true
    GROUP BY sd.simulation_id
),
simulation_department_access_check AS (
    SELECT 
        s.id as simulation_id,
        CASE 
            WHEN uc.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM simulation_departments sd 
                WHERE sd.simulation_id = s.id 
                AND sd.active = true 
                AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM simulation_departments sd2 
                WHERE sd2.simulation_id = s.id 
                AND sd2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM simulations s
    CROSS JOIN user_context uc
    WHERE s.id = (SELECT simulation_id FROM params)
),
simulation_base AS (
    SELECT 
        s.id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        (SELECT sd.agent_domain_id FROM simulation_agent_domains sd WHERE sd.simulation_id = s.id AND sd.type = 'text'::type_simulation_domains LIMIT 1) as simulation_text_domain_id,
        (SELECT sd.agent_domain_id FROM simulation_agent_domains sd WHERE sd.simulation_id = s.id AND sd.type = 'voice'::type_simulation_domains LIMIT 1) as simulation_voice_domain_id,
        (SELECT rga.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE ss.simulation_id = s.id AND ss.active = true 
         ORDER BY ss.position 
         LIMIT 1) as rubric_id,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM simulations s
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    INNER JOIN simulation_department_access_check sdac ON sdac.simulation_id = s.id AND sdac.has_access = true
    WHERE s.id = (SELECT simulation_id FROM params)
),
cohort_usage AS (
    SELECT 
        COUNT(*) FILTER (WHERE cs.active = true) as active_cohort_count,
        COUNT(*) as total_cohort_links
    FROM cohort_simulations cs
    WHERE cs.simulation_id = (SELECT simulation_id FROM params)
),
user_departments AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1)
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = rpi.resolved_profile_id AND EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
),
user_department_ids AS (
    SELECT ARRAY_AGG(id) as ids
    FROM user_departments
),
simulation_scenarios_base AS (
    SELECT 
        ss.simulation_id,
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        ss.active,
        (ss.position = 1) as default_scenario,
        ss.position,
        ss.hints_enabled,
        ss.copy_paste_allowed,
        ss.audio_enabled,
        ss.text_enabled,
        -- rubric_id removed from simulation_scenarios - now in rubric_grade_agents array
        stl.time_limit_seconds,
        COALESCE(
            (SELECT ARRAY_AGG(DISTINCT sf.field_id)
             FROM scenario_fields sf
             WHERE sf.scenario_id = s.id AND sf.active = true),
            ARRAY[]::uuid[]
        ) as parameter_item_ids
    FROM scenarios s
    JOIN simulation_scenarios ss ON ss.scenario_id = s.id
    LEFT JOIN scenario_time_limits stl ON stl.simulation_id = ss.simulation_id AND stl.scenario_id = ss.scenario_id AND stl.active = true
    WHERE ss.simulation_id = (SELECT simulation_id FROM params)
    ORDER BY ss.position
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
    FROM simulation_scenarios ss
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
    WHERE ss.simulation_id = (SELECT simulation_id FROM params)
    GROUP BY ss.scenario_id
),
scenario_rubric_grade_agents_data AS (
    SELECT 
        ssrga.scenario_id,
        ARRAY_AGG(
            (ssrga.rubric_grade_agent_id, rga.rubric_id, (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), 
             rga.grade_agent_id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a_text.id LIMIT 1),
             rgav.audio_agent_id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a_voice.id LIMIT 1))::types.q_get_simulation_detail_v4_rubric_grade_agent
            ORDER BY (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
        ) as rubric_grade_agents
    FROM simulation_scenarios_base ssb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ssb.simulation_id AND ssrga.scenario_id = ssb.scenario_id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN rubrics r ON r.id = rga.rubric_id
    JOIN agents a_text ON a_text.id = rga.grade_agent_id
    LEFT JOIN rubric_grade_agents_audio rgav ON rgav.rubric_grade_agent_id = rga.id
    LEFT JOIN agents a_voice ON a_voice.id = rgav.audio_agent_id
    GROUP BY ssrga.scenario_id
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
             COALESCE(srgad.rubric_grade_agents, '{}'::types.q_get_simulation_detail_v4_rubric_grade_agent[])
            )::types.q_get_simulation_detail_v4_scenario
            ORDER BY sb.position
        ) as scenarios,
        ARRAY_AGG(sb.scenario_id) as scenario_ids
    FROM simulation_scenarios_base sb
    LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
    LEFT JOIN scenario_rubric_grade_agents_data srgad ON srgad.scenario_id = sb.scenario_id
),
valid_scenarios_list AS (
    SELECT DISTINCT
        s.id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description
    FROM scenarios s
    CROSS JOIN user_department_ids udi
    JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
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
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s2.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s2.id LIMIT 1), '') as description
    FROM simulation_scenarios_base ssb
    JOIN scenarios s2 ON s2.id = COALESCE(
        (SELECT st3.parent_id 
         FROM scenario_tree st3 
         WHERE st3.child_id = ssb.scenario_id 
           AND st3.parent_id = st3.child_id 
         LIMIT 1),
        ssb.scenario_id
    )
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s2.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE)
),
valid_scenarios AS (
    SELECT ARRAY_AGG(id::text) as ids
    FROM valid_scenarios_list
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids udi
    WHERE EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = true)
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
    UNION
    SELECT DISTINCT
        r2.id,
        (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r2.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions d ON rd.description_id = d.id WHERE rd.rubric_id = r2.id LIMIT 1), '') as description
    FROM simulation_base sb
    LEFT JOIN simulation_scenarios_rubric_grade_agents ssrga_sb ON ssrga_sb.simulation_id = sb.id
    LEFT JOIN rubric_grade_agents rga_sb ON rga_sb.id = ssrga_sb.rubric_grade_agent_id
    JOIN rubrics r2 ON r2.id = rga_sb.rubric_id
    WHERE rga_sb.rubric_id IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r2.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE)
    UNION
    SELECT DISTINCT
        r3.id,
        (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r3.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions d ON rd.description_id = d.id WHERE rd.rubric_id = r3.id LIMIT 1), '') as description
    FROM simulation_scenarios_base ssb
    JOIN simulation_scenarios_rubric_grade_agents ssrga_ssb ON ssrga_ssb.simulation_id = ssb.simulation_id AND ssrga_ssb.scenario_id = ssb.scenario_id
    JOIN rubric_grade_agents rga_ssb ON rga_ssb.id = ssrga_ssb.rubric_grade_agent_id
    JOIN rubrics r3 ON r3.id = rga_ssb.rubric_id
    WHERE rga_ssb.rubric_id IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r3.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = TRUE)
),
rubrics_data AS (
    SELECT 
        ARRAY_AGG(
            (vr.id, vr.name, vr.description)::types.q_get_simulation_detail_v4_rubric
            ORDER BY vr.name
        ) as rubrics,
        ARRAY_AGG(vr.id::text) as rubric_ids
    FROM valid_rubrics_data vr
),
parameters_data AS (
    SELECT DISTINCT
        p.id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE) as persona_parameter
    FROM parameters p
    JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_department_ids udi
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    GROUP BY p.id, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(udi.ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields f2 ON f2.id = fd2.field_id 
                      WHERE (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f2.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'active' AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true)
),
parameters_full_data AS (
    SELECT 
        ARRAY_AGG(
            (pd.id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter)::types.q_get_simulation_detail_v4_parameter
            ORDER BY pd.name
        ) as parameters
    FROM parameters_data pd
),
parameter_items_data AS (
    SELECT 
        f.id,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as parameter_name
    FROM fields f
    JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE p.id IN (SELECT id FROM parameters_data)
),
parameter_items_list_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.parameter_id, pid.name, pid.description)::types.q_get_simulation_detail_v4_parameter_item
            ORDER BY pid.name
        ) as parameter_items,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id)::types.q_get_simulation_detail_v4_parameter_item_detail
            ORDER BY pid.name
        ) as parameter_item_details
    FROM parameter_items_data pid
),
fields_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_detail_v4_field
            ORDER BY pid.name
        ) as fields
    FROM parameter_items_data pid
),
scenario_persona_data AS (
    SELECT 
        sp.scenario_id,
        sp.persona_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as persona_description,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as persona_color,
        (SELECT i.name FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as persona_icon,
        false as image_model
    FROM scenario_personas sp
    JOIN personas p ON p.id = sp.persona_id
    WHERE sp.scenario_id IN (SELECT id FROM valid_scenarios_list)
      AND sp.active = true
),
scenario_persona_mapping AS (
    SELECT 
        spd.scenario_id,
        ARRAY_AGG(
            (spd.persona_id, spd.persona_name, spd.persona_description, spd.persona_color, spd.persona_icon, spd.image_model)::types.q_get_simulation_detail_v4_persona
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
            (d.id, (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), ''::text)::types.q_get_simulation_detail_v4_document
            ORDER BY (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)
        ) as documents
    FROM scenario_documents_data sdd
    JOIN documents d ON d.id = ANY(sdd.document_ids)
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
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_detail_v4_field
            ORDER BY pid.name
        ) as fields
    FROM scenario_parameter_items_data spid
    JOIN parameter_items_data pid ON pid.id = ANY(spid.parameter_item_ids)
    GROUP BY spid.scenario_id
),
scenarios_full_data AS (
    SELECT 
        ARRAY_AGG(
            (vsl.id, vsl.name, vsl.description,
             COALESCE(
                 (SELECT ARRAY_AGG(spd.persona_id) FROM scenario_persona_data spd WHERE spd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(spm.personas, ARRAY[]::types.q_get_simulation_detail_v4_persona[]),
             COALESCE(sdm.documents, ARRAY[]::types.q_get_simulation_detail_v4_document[]),
             COALESCE(sfm.fields, ARRAY[]::types.q_get_simulation_detail_v4_field[]),
             COALESCE(
                 (SELECT spid.parameter_item_ids FROM scenario_parameter_items_data spid WHERE spid.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(
                 (SELECT sdd.document_ids FROM scenario_documents_data sdd WHERE sdd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             )
            )::types.q_get_simulation_detail_v4_scenario_full
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
department_scenario_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::uuid[]) as scenario_ids
    FROM user_departments ud
    LEFT JOIN scenarios s ON EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    INNER JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE (sd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
    GROUP BY ud.id
),
department_rubric_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT r.id ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::uuid[]) as rubric_ids
    FROM user_departments ud
    LEFT JOIN rubrics r ON EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = true)
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
    GROUP BY ud.id
),
department_cohort_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::uuid[]) as cohort_ids
    FROM user_departments ud
    LEFT JOIN cohorts c ON EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = c.id AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = true)
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
    GROUP BY ud.id
),
departments_data AS (
    SELECT 
        ARRAY_AGG(
            (ud.id, ud.name, ud.description,
             COALESCE(dsci.scenario_ids, ARRAY[]::uuid[]),
             COALESCE(dri.rubric_ids, ARRAY[]::uuid[]),
             COALESCE(dci.cohort_ids, ARRAY[]::uuid[])
            )::types.q_get_simulation_detail_v4_department
            ORDER BY ud.name
        ) as departments,
        ARRAY_AGG(DISTINCT ud.id::text) as department_ids
    FROM user_departments ud
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
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
    FROM simulation_base sb
    JOIN agent_domains adom_text ON adom_text.domain_id = sb.simulation_text_domain_id
    JOIN agents a_text ON a_text.id = adom_text.agent_id
    JOIN domain_artifacts da_text ON da_text.domain_id = adom_text.domain_id AND da_text.artifact = CAST('scenario' AS artifacts)
    JOIN agent_domains adom_voice ON adom_voice.domain_id = sb.simulation_voice_domain_id
    JOIN agents a_voice ON a_voice.id = adom_voice.agent_id
    JOIN domain_artifacts da_voice ON da_voice.domain_id = adom_voice.domain_id AND da_voice.artifact = CAST('message' AS artifacts)
    JOIN agents a ON (a.id = a_text.id OR a.id = a_voice.id)
    LEFT JOIN agent_domains adom ON adom.agent_id = a.id
    LEFT JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    AND (
        (a.id = a_text.id AND da_text.artifact = CAST('scenario' AS artifacts))
        OR (a.id = a_voice.id AND da_voice.artifact = CAST('message' AS artifacts))
    )
      AND (
          sb.simulation_text_domain_id IS NOT NULL
          OR sb.simulation_voice_domain_id IS NOT NULL
      )
    UNION
    -- Get grade agents from junction tables
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
    FROM simulation_base sb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = sb.id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN agents a ON a.id = rga.grade_agent_id
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('grade' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    UNION
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
    FROM simulation_base sb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = sb.id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN rubric_grade_agents_audio rgav ON rgav.rubric_grade_agent_id = rga.id
    JOIN agents a ON a.id = rgav.audio_agent_id
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('grade' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    UNION
    -- Get rubric agents (member role) from rubric_domains
    SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
    FROM simulation_base sb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = sb.id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN rubrics r ON r.id = rga.rubric_id
    JOIN rubric_domains rd_link ON rd_link.rubric_id = r.id
    JOIN agent_domains adom ON adom.domain_id = rd_link.domain_id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
    JOIN agents a ON a.id = adom.agent_id
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
),
agents_data AS (
    SELECT 
        ARRAY_AGG(
            (filtered_agents.id, filtered_agents.name, COALESCE(filtered_agents.description, ''), ARRAY[filtered_agents.role::text])::types.q_get_simulation_detail_v4_agent
            ORDER BY filtered_agents.name
        ) as agents,
        ARRAY_AGG(filtered_agents.id ORDER BY filtered_agents.name) as agent_ids
    FROM (
        SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
        FROM agents a
        JOIN agent_domains adom ON adom.agent_id = a.id
        JOIN domain_artifacts da ON da.domain_id = adom.domain_id
        LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true) 
        AND da.artifact IN (CAST('message' AS artifacts), CAST('grade' AS artifacts), CAST('scenario' AS artifacts), CAST('agent' AS artifacts))
        GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), da.artifact
        HAVING 
            COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
            OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        UNION
        SELECT DISTINCT sas.id, sas.name, sas.description, sas.role
        FROM selected_agents_from_simulation sas
    ) filtered_agents
),
-- Auto-select default agents when there's only one option for each role (for new simulations or when simulation doesn't have agent set)
valid_hint_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('message' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_simulation_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('scenario' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_voice_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('message' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
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
)
SELECT 
    (SELECT simulation_exists FROM simulation_exists_check) as simulation_exists,
    uc.actor_name::text as actor_name,
    sb.id as simulation_id,
    -- Merge draft payload over existing simulation data if draft_id provided
    COALESCE(
        (SELECT payload->>'title' FROM draft_payload_data),
        sb.title
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        sb.description
    ) as description,
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
        sb.department_ids
    ) as department_ids,
    COALESCE(dd.department_ids::uuid[], ARRAY[]::uuid[]) as valid_department_ids,
    sb.time_limit,
    sb.rubric_id,
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
        COALESCE(sd.scenario_ids::uuid[], ARRAY[]::uuid[])
    ) as scenario_ids,
    COALESCE(vs.ids::uuid[], ARRAY[]::uuid[]) as valid_scenario_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        sb.active
    ) as active,
    COALESCE(
        (SELECT (payload->>'practiceSimulation')::boolean FROM draft_payload_data),
        (SELECT (payload->>'practice_simulation')::boolean FROM draft_payload_data),
        sb.practice_simulation
    ) as practice_simulation,
    -- Auto-select domains: draft payload -> simulation value -> default from SQL (if only one option) -> NULL
    COALESCE(
        (SELECT (payload->>'simulation_text_domain_id')::uuid FROM draft_payload_data),
        sb.simulation_text_domain_id,
        (SELECT id FROM default_simulation_agent),
        NULL::uuid
    ) as simulation_text_domain_id,
    COALESCE(
        (SELECT (payload->>'simulation_voice_domain_id')::uuid FROM draft_payload_data),
        sb.simulation_voice_domain_id,
        (SELECT id FROM default_voice_agent),
        NULL::uuid
    ) as simulation_voice_domain_id,
    CASE 
        WHEN COALESCE(sb.department_ids, NULL) IS NULL AND uc.role != 'superadmin' THEN false
        WHEN uc.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN uc.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_duplicate,
    CASE 
        WHEN COALESCE(sb.department_ids, NULL) IS NULL AND uc.role != 'superadmin' THEN false
        WHEN sb.practice_simulation = true THEN false
        WHEN cu.total_cohort_links > 0 THEN false
        WHEN uc.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_delete,
    CASE WHEN cu.total_cohort_links > 0 THEN true ELSE false END as in_use,
    COALESCE(cu.total_cohort_links, 0) as cohort_count,
    COALESCE(sd.scenarios, ARRAY[]::types.q_get_simulation_detail_v4_scenario[]) as scenarios,
    COALESCE(pild.parameter_items, ARRAY[]::types.q_get_simulation_detail_v4_parameter_item[]) as parameters,
    COALESCE(pild.parameter_item_details, ARRAY[]::types.q_get_simulation_detail_v4_parameter_item_detail[]) as parameter_items,
    COALESCE(sfd.scenarios_full, ARRAY[]::types.q_get_simulation_detail_v4_scenario_full[]) as scenarios_full,
    COALESCE(rd.rubrics, ARRAY[]::types.q_get_simulation_detail_v4_rubric[]) as rubrics,
    COALESCE(dd.departments, ARRAY[]::types.q_get_simulation_detail_v4_department[]) as departments,
    COALESCE(pfd.parameters, ARRAY[]::types.q_get_simulation_detail_v4_parameter[]) as parameters_full,
    COALESCE(fd.fields, ARRAY[]::types.q_get_simulation_detail_v4_field[]) as fields,
    COALESCE(ad.agents, ARRAY[]::types.q_get_simulation_detail_v4_agent[]) as agents,
    COALESCE(ad.agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
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
FROM simulation_base sb
CROSS JOIN user_context uc
CROSS JOIN cohort_usage cu
CROSS JOIN scenarios_data sd
CROSS JOIN valid_scenarios vs
CROSS JOIN rubrics_data rd
CROSS JOIN parameters_full_data pfd
CROSS JOIN fields_data fd
CROSS JOIN parameter_items_list_data pild
CROSS JOIN scenarios_full_data sfd
CROSS JOIN departments_data dd
CROSS JOIN agents_data ad
$$;