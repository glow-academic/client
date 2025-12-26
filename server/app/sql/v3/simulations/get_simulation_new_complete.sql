-- Get default simulation details for new simulation form
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_simulation_new_v3(uuid);

-- 2) Drop types WITHOUT CASCADE (reuse types from detail if they exist, but drop/recreate for consistency)
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_scenario;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_parameter_item;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_parameter_item_detail;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_scenario_mapping;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_persona;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_document;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_field;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_rubric;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_department;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_parameter;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_agent;
DROP TYPE IF EXISTS types.q_get_simulation_new_v3_video;

-- 3) Recreate types (same structure as detail)
CREATE TYPE types.q_get_simulation_new_v3_scenario AS (
    scenario_id uuid,
    title text,
    description text,
    active boolean,
    position int,
    parameter_item_ids uuid[],
    hints_enabled boolean,
    objectives_enabled boolean,
    image_input_enabled boolean,
    rubric_id uuid,
    time_limit_seconds int,
    usage_count int,
    success_rate int,
    last_used timestamptz,
    can_remove boolean,
    has_active_video boolean
);

CREATE TYPE types.q_get_simulation_new_v3_parameter_item AS (
    id uuid,
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v3_parameter_item_detail AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.q_get_simulation_new_v3_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_get_simulation_new_v3_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v3_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_simulation_new_v3_scenario_mapping AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    persona_mapping types.q_get_simulation_new_v3_persona[],
    document_mapping types.q_get_simulation_new_v3_document[],
    parameter_item_mapping types.q_get_simulation_new_v3_field[],
    parameter_item_ids uuid[],
    document_ids uuid[]
);

CREATE TYPE types.q_get_simulation_new_v3_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v3_department AS (
    department_id uuid,
    name text,
    description text,
    scenario_ids uuid[],
    rubric_ids uuid[],
    cohort_ids uuid[]
);

CREATE TYPE types.q_get_simulation_new_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_simulation_new_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_simulation_new_v3_video AS (
    video_id uuid,
    name text,
    description text,
    length_seconds int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_new_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    name text,
    description text,
    department_ids uuid[],
    valid_department_ids uuid[],
    time_limit int,
    rubric_id uuid,
    valid_rubric_ids uuid[],
    scenario_ids uuid[],
    valid_scenario_ids uuid[],
    video_ids uuid[],
    valid_video_ids uuid[],
    active boolean,
    practice_simulation boolean,
    hint_agent_id uuid,
    grade_text_agent_id uuid,
    grade_voice_agent_id uuid,
    simulation_text_agent_id uuid,
    simulation_voice_agent_id uuid,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    cohort_count bigint,
    scenarios types.q_get_simulation_new_v3_scenario[],
    videos types.q_get_simulation_new_v3_video[],
    parameters types.q_get_simulation_new_v3_parameter_item[],
    parameter_items types.q_get_simulation_new_v3_parameter_item_detail[],
    scenarios_full types.q_get_simulation_new_v3_scenario_mapping[],
    rubrics types.q_get_simulation_new_v3_rubric[],
    departments types.q_get_simulation_new_v3_department[],
    parameters_full types.q_get_simulation_new_v3_parameter[],
    fields types.q_get_simulation_new_v3_field[],
    agents types.q_get_simulation_new_v3_agent[],
    valid_agent_ids uuid[],
    primary_department_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT 
        role,
        first_name || ' ' || last_name as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
primary_department_id AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
cohort_usage AS (
    SELECT 
        0 as active_cohort_count,
        0 as total_cohort_links
),
user_department_ids AS (
    SELECT ARRAY_AGG(id) as ids
    FROM departments d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND d.active = true
),
valid_scenarios_list AS (
    SELECT DISTINCT
        s.id,
        s.name,
        COALESCE(ps.problem_statement, '') as description
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    CROSS JOIN user_department_ids udi
    JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    WHERE s.active = true
      AND (
          sd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
      )
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
    FROM videos v
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
            (vvl.id, vvl.name, ''::text, vvl.length_seconds)::types.q_get_simulation_new_v3_video
            ORDER BY vvl.name
        ) as videos
    FROM valid_videos_list vvl
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
      AND r.agent_role = 'member'
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
),
rubrics_data AS (
    SELECT 
        ARRAY_AGG(
            (vr.id, vr.name, vr.description)::types.q_get_simulation_new_v3_rubric
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
            (pd.id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter)::types.q_get_simulation_new_v3_parameter
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
            (pid.id, pid.parameter_id, pid.name, pid.description)::types.q_get_simulation_new_v3_parameter_item
            ORDER BY pid.name
        ) as parameter_items,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id)::types.q_get_simulation_new_v3_parameter_item_detail
            ORDER BY pid.name
        ) as parameter_item_details
    FROM parameter_items_data pid
),
fields_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_new_v3_field
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
            (spd.persona_id, spd.persona_name, spd.persona_description, spd.persona_color, spd.persona_icon, spd.image_model)::types.q_get_simulation_new_v3_persona
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
            (d.id, d.name, ''::text)::types.q_get_simulation_new_v3_document
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
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_new_v3_field
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
             COALESCE(spm.personas, ARRAY[]::types.q_get_simulation_new_v3_persona[]),
             COALESCE(sdm.documents, ARRAY[]::types.q_get_simulation_new_v3_document[]),
             COALESCE(sfm.fields, ARRAY[]::types.q_get_simulation_new_v3_field[]),
             COALESCE(
                 (SELECT spid.parameter_item_ids FROM scenario_parameter_items_data spid WHERE spid.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(
                 (SELECT sdd.document_ids FROM scenario_documents_data sdd WHERE sdd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             )
            )::types.q_get_simulation_new_v3_scenario_mapping
            ORDER BY vsl.name
        ) as scenarios_full
    FROM valid_scenarios_list vsl
    LEFT JOIN scenario_persona_mapping spm ON spm.scenario_id = vsl.id
    LEFT JOIN scenario_document_mapping sdm ON sdm.scenario_id = vsl.id
    LEFT JOIN scenario_field_mapping sfm ON sfm.scenario_id = vsl.id
),
user_departments_for_mapping AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND d.active = true
),
department_scenario_ids_default AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::uuid[]) as scenario_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN scenarios s ON s.active = true
    INNER JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE (sd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
    GROUP BY ud.id
),
department_rubric_ids_default AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT r.id ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), ARRAY[]::uuid[]) as rubric_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN rubrics r ON r.active = true
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE (rd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true))
    GROUP BY ud.id
),
departments_data AS (
    SELECT 
        ARRAY_AGG(
            (ud.id, ud.name, ud.description,
             COALESCE(dsci.scenario_ids, ARRAY[]::uuid[]),
             COALESCE(dri.rubric_ids, ARRAY[]::uuid[]),
             ARRAY[]::uuid[]
            )::types.q_get_simulation_new_v3_department
            ORDER BY ud.name
        ) as departments,
        ARRAY_AGG(DISTINCT ud.id::text) as department_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN department_scenario_ids_default dsci ON dsci.department_id = ud.id
    LEFT JOIN department_rubric_ids_default dri ON dri.department_id = ud.id
),
user_departments_for_agents AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.active = true
),
agents_data AS (
    SELECT 
        ARRAY_AGG(
            (filtered_agents.id, filtered_agents.name, COALESCE(filtered_agents.description, ''), ARRAY[filtered_agents.role::text])::types.q_get_simulation_new_v3_agent
            ORDER BY filtered_agents.name
        ) as agents,
        ARRAY_AGG(filtered_agents.id ORDER BY filtered_agents.name) as agent_ids
    FROM (
        SELECT DISTINCT a.id, a.name, a.description, a.role
        FROM agents a
        LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
        WHERE a.active = true 
        AND a.role IN ('hint', 'grade', 'grade-text', 'grade-voice')
        GROUP BY a.id, a.name, a.description, a.role
        HAVING 
            COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
            OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    ) filtered_agents
)
SELECT 
    up.actor_name::text as actor_name,
    ''::text as name,
    ''::text as description,
    CASE 
        WHEN up.role = 'superadmin' THEN NULL::uuid[]
        ELSE COALESCE(ARRAY[pdi.department_id], ARRAY[]::uuid[])
    END as department_ids,
    COALESCE(dd.department_ids::uuid[], ARRAY[]::uuid[]) as valid_department_ids,
    0 as time_limit,
    NULL::uuid as rubric_id,
    COALESCE(rd.rubric_ids::uuid[], ARRAY[]::uuid[]) as valid_rubric_ids,
    ARRAY[]::uuid[] as scenario_ids,
    COALESCE(vs.ids::uuid[], ARRAY[]::uuid[]) as valid_scenario_ids,
    ARRAY[]::uuid[] as video_ids,
    COALESCE(vv.ids::uuid[], ARRAY[]::uuid[]) as valid_video_ids,
    true as active,
    false as practice_simulation,
    NULL::uuid as hint_agent_id,
    NULL::uuid as grade_text_agent_id,
    NULL::uuid as grade_voice_agent_id,
    NULL::uuid as simulation_text_agent_id,
    NULL::uuid as simulation_voice_agent_id,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_duplicate,
    false as can_delete,
    false as in_use,
    0::bigint as cohort_count,
    ARRAY[]::types.q_get_simulation_new_v3_scenario[] as scenarios,
    COALESCE(vd.videos, ARRAY[]::types.q_get_simulation_new_v3_video[]) as videos,
    COALESCE(pild.parameter_items, ARRAY[]::types.q_get_simulation_new_v3_parameter_item[]) as parameters,
    COALESCE(pild.parameter_item_details, ARRAY[]::types.q_get_simulation_new_v3_parameter_item_detail[]) as parameter_items,
    COALESCE(sfd.scenarios_full, ARRAY[]::types.q_get_simulation_new_v3_scenario_mapping[]) as scenarios_full,
    COALESCE(rd.rubrics, ARRAY[]::types.q_get_simulation_new_v3_rubric[]) as rubrics,
    COALESCE(dd.departments, ARRAY[]::types.q_get_simulation_new_v3_department[]) as departments,
    COALESCE(pfd.parameters, ARRAY[]::types.q_get_simulation_new_v3_parameter[]) as parameters_full,
    COALESCE(fd.fields, ARRAY[]::types.q_get_simulation_new_v3_field[]) as fields,
    COALESCE(ad.agents, ARRAY[]::types.q_get_simulation_new_v3_agent[]) as agents,
    COALESCE(ad.agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    pdi.department_id as primary_department_id
FROM user_profile up
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
LEFT JOIN primary_department_id pdi ON true
$$;

COMMIT;
