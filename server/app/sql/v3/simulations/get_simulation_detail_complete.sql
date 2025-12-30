-- Get simulation detail with departments, scenarios, and access control
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_detail_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop scenario_full first (depends on document), then document, then other types
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_scenario_full;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_document;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_scenario;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_parameter_item;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_parameter_item_detail;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_persona;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_field;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_rubric;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_rubric_grade_agent;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_department;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_parameter;
DROP TYPE IF EXISTS types.q_get_simulation_detail_v3_agent;

-- 3) Recreate types
-- Create rubric_grade_agent type first (used by scenario type)
CREATE TYPE types.q_get_simulation_detail_v3_rubric_grade_agent AS (
    rubric_grade_agent_id uuid,
    rubric_id uuid,
    rubric_name text,
    grade_text_agent_id uuid,
    grade_text_agent_name text,
    grade_voice_agent_id uuid,
    grade_voice_agent_name text
);

CREATE TYPE types.q_get_simulation_detail_v3_scenario AS (
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
    rubric_grade_agents types.q_get_simulation_detail_v3_rubric_grade_agent[]
);

CREATE TYPE types.q_get_simulation_detail_v3_parameter_item AS (
    id uuid,
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v3_parameter_item_detail AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.q_get_simulation_detail_v3_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_get_simulation_detail_v3_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v3_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_simulation_detail_v3_scenario_full AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    persona_mapping types.q_get_simulation_detail_v3_persona[],
    document_mapping types.q_get_simulation_detail_v3_document[],
    parameter_item_mapping types.q_get_simulation_detail_v3_field[],
    parameter_item_ids uuid[],
    document_ids uuid[]
);

CREATE TYPE types.q_get_simulation_detail_v3_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_detail_v3_department AS (
    department_id uuid,
    name text,
    description text,
    scenario_ids uuid[],
    rubric_ids uuid[],
    cohort_ids uuid[]
);

CREATE TYPE types.q_get_simulation_detail_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_simulation_detail_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_detail_v3(
    simulation_id uuid,
    profile_id uuid
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
    hint_agent_id uuid,
    simulation_text_agent_id uuid,
    simulation_voice_agent_id uuid,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    cohort_count bigint,
    scenarios types.q_get_simulation_detail_v3_scenario[],
    parameters types.q_get_simulation_detail_v3_parameter_item[],
    parameter_items types.q_get_simulation_detail_v3_parameter_item_detail[],
    scenarios_full types.q_get_simulation_detail_v3_scenario_full[],
    rubrics types.q_get_simulation_detail_v3_rubric[],
    departments types.q_get_simulation_detail_v3_department[],
    parameters_full types.q_get_simulation_detail_v3_parameter[],
    fields types.q_get_simulation_detail_v3_field[],
    agents types.q_get_simulation_detail_v3_agent[],
    valid_agent_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS simulation_id,
           profile_id AS profile_id
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
        p.first_name || ' ' || p.last_name as actor_name
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
        s.title,
        s.description,
        s.active,
        s.practice_simulation,
        s.hint_agent_id,
        s.simulation_text_agent_id,
        s.simulation_voice_agent_id,
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
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
),
user_department_ids AS (
    SELECT ARRAY_AGG(id) as ids
    FROM user_departments
),
simulation_scenarios_base AS (
    SELECT 
        ss.simulation_id,
        s.id as scenario_id,
        s.name,
        COALESCE(s.description, '') as description,
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
            (ssrga.rubric_grade_agent_id, rga.rubric_id, r.name, 
             rga.grade_text_agent_id, a_text.name,
             rgav.grade_voice_agent_id, a_voice.name)::types.q_get_simulation_detail_v3_rubric_grade_agent
            ORDER BY r.name
        ) as rubric_grade_agents
    FROM simulation_scenarios_base ssb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ssb.simulation_id AND ssrga.scenario_id = ssb.scenario_id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN rubrics r ON r.id = rga.rubric_id
    JOIN agents a_text ON a_text.id = rga.grade_text_agent_id
    LEFT JOIN rubric_grade_agents_voice rgav ON rgav.rubric_grade_agent_id = rga.id
    LEFT JOIN agents a_voice ON a_voice.id = rgav.grade_voice_agent_id
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
             COALESCE(srgad.rubric_grade_agents, '{}'::types.q_get_simulation_detail_v3_rubric_grade_agent[])
            )::types.q_get_simulation_detail_v3_scenario
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
        s.name,
        COALESCE(s.description, '') as description
    FROM scenarios s
    CROSS JOIN user_department_ids udi
    JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE s.active = true
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
        s2.name,
        COALESCE(s2.description, '') as description
    FROM simulation_scenarios_base ssb
    JOIN scenarios s2 ON s2.id = COALESCE(
        (SELECT st3.parent_id 
         FROM scenario_tree st3 
         WHERE st3.child_id = ssb.scenario_id 
           AND st3.parent_id = st3.child_id 
         LIMIT 1),
        ssb.scenario_id
    )
    WHERE s2.active = true
),
valid_scenarios AS (
    SELECT ARRAY_AGG(id::text) as ids
    FROM valid_scenarios_list
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        r.name,
        COALESCE(r.description, '') as description
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids udi
    WHERE r.active = true
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
    UNION
    SELECT DISTINCT
        r2.id,
        r2.name,
        COALESCE(r2.description, '') as description
    FROM simulation_base sb
    LEFT JOIN simulation_scenarios_rubric_grade_agents ssrga_sb ON ssrga_sb.simulation_id = sb.id
    LEFT JOIN rubric_grade_agents rga_sb ON rga_sb.id = ssrga_sb.rubric_grade_agent_id
    JOIN rubrics r2 ON r2.id = rga_sb.rubric_id
    WHERE rga_sb.rubric_id IS NOT NULL AND r2.active = true
    UNION
    SELECT DISTINCT
        r3.id,
        r3.name,
        COALESCE(r3.description, '') as description
    FROM simulation_scenarios_base ssb
    JOIN simulation_scenarios_rubric_grade_agents ssrga_ssb ON ssrga_ssb.simulation_id = ssb.simulation_id AND ssrga_ssb.scenario_id = ssb.scenario_id
    JOIN rubric_grade_agents rga_ssb ON rga_ssb.id = ssrga_ssb.rubric_grade_agent_id
    JOIN rubrics r3 ON r3.id = rga_ssb.rubric_id
    WHERE rga_ssb.rubric_id IS NOT NULL AND r3.active = true
),
rubrics_data AS (
    SELECT 
        ARRAY_AGG(
            (vr.id, vr.name, vr.description)::types.q_get_simulation_detail_v3_rubric
            ORDER BY vr.name
        ) as rubrics,
        ARRAY_AGG(vr.id::text) as rubric_ids
    FROM valid_rubrics_data vr
),
parameters_data AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter
    FROM parameters p
    JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    CROSS JOIN user_department_ids udi
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(udi.ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                      WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true)
),
parameters_full_data AS (
    SELECT 
        ARRAY_AGG(
            (pd.id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter)::types.q_get_simulation_detail_v3_parameter
            ORDER BY pd.name
        ) as parameters
    FROM parameters_data pd
),
parameter_items_data AS (
    SELECT 
        f.id,
        fp.parameter_id,
        f.name,
        COALESCE(f.description, '') as description,
        p.name as parameter_name
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE p.id IN (SELECT id FROM parameters_data)
),
parameter_items_list_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.parameter_id, pid.name, pid.description)::types.q_get_simulation_detail_v3_parameter_item
            ORDER BY pid.name
        ) as parameter_items,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id)::types.q_get_simulation_detail_v3_parameter_item_detail
            ORDER BY pid.name
        ) as parameter_item_details
    FROM parameter_items_data pid
),
fields_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_detail_v3_field
            ORDER BY pid.name
        ) as fields
    FROM parameter_items_data pid
),
scenario_persona_data AS (
    SELECT 
        sp.scenario_id,
        sp.persona_id,
        p.name as persona_name,
        COALESCE(p.description, '') as persona_description,
        p.color as persona_color,
        p.icon as persona_icon,
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
            (spd.persona_id, spd.persona_name, spd.persona_description, spd.persona_color, spd.persona_icon, spd.image_model)::types.q_get_simulation_detail_v3_persona
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
            (d.id, d.name, ''::text)::types.q_get_simulation_detail_v3_document
            ORDER BY d.name
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
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_detail_v3_field
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
             COALESCE(spm.personas, ARRAY[]::types.q_get_simulation_detail_v3_persona[]),
             COALESCE(sdm.documents, ARRAY[]::types.q_get_simulation_detail_v3_document[]),
             COALESCE(sfm.fields, ARRAY[]::types.q_get_simulation_detail_v3_field[]),
             COALESCE(
                 (SELECT spid.parameter_item_ids FROM scenario_parameter_items_data spid WHERE spid.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(
                 (SELECT sdd.document_ids FROM scenario_documents_data sdd WHERE sdd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             )
            )::types.q_get_simulation_detail_v3_scenario_full
            ORDER BY vsl.name
        ) as scenarios_full
    FROM valid_scenarios_list vsl
    LEFT JOIN scenario_persona_mapping spm ON spm.scenario_id = vsl.id
    LEFT JOIN scenario_document_mapping sdm ON sdm.scenario_id = vsl.id
    LEFT JOIN scenario_field_mapping sfm ON sfm.scenario_id = vsl.id
),
department_scenario_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::uuid[]) as scenario_ids
    FROM user_departments ud
    LEFT JOIN scenarios s ON s.active = true
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
    LEFT JOIN rubrics r ON r.active = true
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
    GROUP BY ud.id
),
department_cohort_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::uuid[]) as cohort_ids
    FROM user_departments ud
    LEFT JOIN cohorts c ON c.active = true
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
            )::types.q_get_simulation_detail_v3_department
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
    SELECT DISTINCT a.id, a.name, a.description, a.role
    FROM simulation_base sb
    JOIN agents a ON (
        (a.id = sb.hint_agent_id AND a.role = 'hint'::agent_role)
        OR (a.id = sb.simulation_text_agent_id AND a.role = 'simulation'::agent_role)
        OR (a.id = sb.simulation_voice_agent_id AND a.role = 'voice'::agent_role)
    )
    WHERE a.active = true
      AND (
          sb.hint_agent_id IS NOT NULL
          OR sb.simulation_text_agent_id IS NOT NULL
          OR sb.simulation_voice_agent_id IS NOT NULL
      )
    UNION
    -- Get grade agents from junction tables
    SELECT DISTINCT a.id, a.name, a.description, a.role
    FROM simulation_base sb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = sb.id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN agents a ON a.id = rga.grade_text_agent_id AND a.role IN ('grade'::agent_role)
    WHERE a.active = true
    UNION
    SELECT DISTINCT a.id, a.name, a.description, a.role
    FROM simulation_base sb
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = sb.id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN rubric_grade_agents_voice rgav ON rgav.rubric_grade_agent_id = rga.id
    JOIN agents a ON a.id = rgav.grade_voice_agent_id AND a.role IN ('audio'::agent_role)
    WHERE a.active = true
),
agents_data AS (
    SELECT 
        ARRAY_AGG(
            (filtered_agents.id, filtered_agents.name, COALESCE(filtered_agents.description, ''), ARRAY[filtered_agents.role::text])::types.q_get_simulation_detail_v3_agent
            ORDER BY filtered_agents.name
        ) as agents,
        ARRAY_AGG(filtered_agents.id ORDER BY filtered_agents.name) as agent_ids
    FROM (
        SELECT DISTINCT a.id, a.name, a.description, a.role
        FROM agents a
        LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
        WHERE a.active = true 
        AND a.role IN ('hint'::agent_role, 'grade'::agent_role, 'audio'::agent_role, 'simulation'::agent_role, 'voice'::agent_role)
        GROUP BY a.id, a.name, a.description, a.role
        HAVING 
            COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
            OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        UNION
        SELECT DISTINCT sas.id, sas.name, sas.description, sas.role
        FROM selected_agents_from_simulation sas
    ) filtered_agents
)
SELECT 
    (SELECT simulation_exists FROM simulation_exists_check) as simulation_exists,
    uc.actor_name::text as actor_name,
    sb.id as simulation_id,
    sb.title as name,
    sb.description,
    sb.department_ids,
    COALESCE(dd.department_ids::uuid[], ARRAY[]::uuid[]) as valid_department_ids,
    sb.time_limit,
    sb.rubric_id,
    COALESCE(rd.rubric_ids::uuid[], ARRAY[]::uuid[]) as valid_rubric_ids,
    COALESCE(sd.scenario_ids::uuid[], ARRAY[]::uuid[]) as scenario_ids,
    COALESCE(vs.ids::uuid[], ARRAY[]::uuid[]) as valid_scenario_ids,
    sb.active,
    sb.practice_simulation,
    sb.hint_agent_id,
    sb.simulation_text_agent_id,
    sb.simulation_voice_agent_id,
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
    COALESCE(sd.scenarios, ARRAY[]::types.q_get_simulation_detail_v3_scenario[]) as scenarios,
    COALESCE(pild.parameter_items, ARRAY[]::types.q_get_simulation_detail_v3_parameter_item[]) as parameters,
    COALESCE(pild.parameter_item_details, ARRAY[]::types.q_get_simulation_detail_v3_parameter_item_detail[]) as parameter_items,
    COALESCE(sfd.scenarios_full, ARRAY[]::types.q_get_simulation_detail_v3_scenario_full[]) as scenarios_full,
    COALESCE(rd.rubrics, ARRAY[]::types.q_get_simulation_detail_v3_rubric[]) as rubrics,
    COALESCE(dd.departments, ARRAY[]::types.q_get_simulation_detail_v3_department[]) as departments,
    COALESCE(pfd.parameters, ARRAY[]::types.q_get_simulation_detail_v3_parameter[]) as parameters_full,
    COALESCE(fd.fields, ARRAY[]::types.q_get_simulation_detail_v3_field[]) as fields,
    COALESCE(ad.agents, ARRAY[]::types.q_get_simulation_detail_v3_agent[]) as agents,
    COALESCE(ad.agent_ids, ARRAY[]::uuid[]) as valid_agent_ids
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

COMMIT;
