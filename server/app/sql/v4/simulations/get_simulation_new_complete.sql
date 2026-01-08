-- Get default simulation details for new simulation form
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    func_rec RECORD;
BEGIN
    FOR func_rec IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_new_v4(%s)', func_rec.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop scenario_full first (depends on document), then document, then other types
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_scenario_full;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_document;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_scenario;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_parameter_item;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_parameter_item_detail;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_department;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_persona;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_parameter;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_field;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_rubric;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_agent;
DROP TYPE IF EXISTS types.q_get_simulation_new_v4_video;

-- 3) Recreate types (same structure as detail)
CREATE TYPE types.q_get_simulation_new_v4_scenario AS (
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

CREATE TYPE types.q_get_simulation_new_v4_parameter_item AS (
    id uuid,
    parameter_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v4_parameter_item_detail AS (
    id uuid,
    name text,
    description text,
    parameter_id uuid
);

CREATE TYPE types.q_get_simulation_new_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_get_simulation_new_v4_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_simulation_new_v4_scenario_full AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    persona_mapping types.q_get_simulation_new_v4_persona[],
    document_mapping types.q_get_simulation_new_v4_document[],
    parameter_item_mapping types.q_get_simulation_new_v4_field[],
    parameter_item_ids uuid[],
    document_ids uuid[]
);

CREATE TYPE types.q_get_simulation_new_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_simulation_new_v4_department AS (
    department_id uuid,
    name text,
    description text,
    scenario_ids uuid[],
    rubric_ids uuid[],
    cohort_ids uuid[]
);

CREATE TYPE types.q_get_simulation_new_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_simulation_new_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_simulation_new_v4_video AS (
    video_id uuid,
    name text,
    description text,
    length_seconds int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
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
    simulation_text_agent_id uuid,
    simulation_voice_agent_id uuid,
    member_agent_id uuid,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    cohort_count bigint,
    scenarios types.q_get_simulation_new_v4_scenario[],
    videos types.q_get_simulation_new_v4_video[],
    parameters types.q_get_simulation_new_v4_parameter_item[],
    parameter_items types.q_get_simulation_new_v4_parameter_item_detail[],
    scenarios_full types.q_get_simulation_new_v4_scenario_full[],
    rubrics types.q_get_simulation_new_v4_rubric[],
    departments types.q_get_simulation_new_v4_department[],
    parameters_full types.q_get_simulation_new_v4_parameter[],
    fields types.q_get_simulation_new_v4_field[],
    agents types.q_get_simulation_new_v4_agent[],
    valid_agent_ids uuid[],
    primary_department_id uuid,
    draft_version int,
    scenario_active_states jsonb,
    scenario_settings jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
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
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
),
valid_scenarios_list AS (
    SELECT DISTINCT
        s.id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    CROSS JOIN user_department_ids udi
    JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
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
            (vvl.id, vvl.name, ''::text, vvl.length_seconds)::types.q_get_simulation_new_v4_video
            ORDER BY vvl.name
        ) as videos
    FROM valid_videos_list vvl
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
      AND EXISTS (SELECT 1 FROM domain_artifacts da WHERE da.artifact = CAST('agent' AS artifacts))
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
),
rubrics_data AS (
    SELECT 
        ARRAY_AGG(
            (vr.id, vr.name, vr.description)::types.q_get_simulation_new_v4_rubric
            ORDER BY vr.name
        ) as rubrics,
        ARRAY_AGG(vr.id::text) as rubric_ids
    FROM valid_rubrics_data vr
),
parameters_data AS (
    SELECT DISTINCT
        p.id,
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE) as persona_parameter
    FROM parameters p
    JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_department_ids udi
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_parameter_flags AND pf.value = true)
    GROUP BY p.id, (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1), (SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(udi.ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields f2 ON f2.id = fd2.field_id 
                      JOIN parameter_fields pf2 ON pf2.field_id = f2.id
                      WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'active' AND ff2.type = 'active'::type_field_flags AND ff2.value = true) AND fd2.active = true)
),
parameters_full_data AS (
    SELECT 
        ARRAY_AGG(
            (pd.id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter)::types.q_get_simulation_new_v4_parameter
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
            (pid.id, pid.parameter_id, pid.name, pid.description)::types.q_get_simulation_new_v4_parameter_item
            ORDER BY pid.name
        ) as parameter_items,
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id)::types.q_get_simulation_new_v4_parameter_item_detail
            ORDER BY pid.name
        ) as parameter_item_details
    FROM parameter_items_data pid
),
fields_data AS (
    SELECT 
        ARRAY_AGG(
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_new_v4_field
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
        (SELECT i.value FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as persona_icon,
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
            (spd.persona_id, spd.persona_name, spd.persona_description, spd.persona_color, spd.persona_icon, spd.image_model)::types.q_get_simulation_new_v4_persona
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
            (d.id, (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), ''::text)::types.q_get_simulation_new_v4_document
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
            (pid.id, pid.name, pid.description, pid.parameter_id, pid.parameter_name)::types.q_get_simulation_new_v4_field
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
             COALESCE(spm.personas, ARRAY[]::types.q_get_simulation_new_v4_persona[]),
             COALESCE(sdm.documents, ARRAY[]::types.q_get_simulation_new_v4_document[]),
             COALESCE(sfm.fields, ARRAY[]::types.q_get_simulation_new_v4_field[]),
             COALESCE(
                 (SELECT spid.parameter_item_ids FROM scenario_parameter_items_data spid WHERE spid.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             ),
             COALESCE(
                 (SELECT sdd.document_ids FROM scenario_documents_data sdd WHERE sdd.scenario_id = vsl.id),
                 ARRAY[]::uuid[]
             )
            )::types.q_get_simulation_new_v4_scenario_full
            ORDER BY vsl.name
        ) as scenarios_full
    FROM valid_scenarios_list vsl
    LEFT JOIN scenario_persona_mapping spm ON spm.scenario_id = vsl.id
    LEFT JOIN scenario_document_mapping sdm ON sdm.scenario_id = vsl.id
    LEFT JOIN scenario_field_mapping sfm ON sfm.scenario_id = vsl.id
),
user_departments_for_mapping AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1)
    FROM departments d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
),
department_scenario_ids_default AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT s.id ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::uuid[]) as scenario_ids
    FROM user_departments_for_mapping ud
    LEFT JOIN scenarios s ON EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
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
    LEFT JOIN rubrics r ON EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = true) AND EXISTS (SELECT 1 FROM rubric_artifacts ra WHERE ra.rubric_id = r.id AND ra.artifact = CAST('agent' AS artifacts))
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
            )::types.q_get_simulation_new_v4_department
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
            (filtered_agents.id, filtered_agents.name, COALESCE(filtered_agents.description, ''), ARRAY[filtered_agents.role::text])::types.q_get_simulation_new_v4_agent
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
        -- Get rubric agents (member role) from rubric_domains
        SELECT DISTINCT a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), COALESCE(da.artifact::text, '') as role
        FROM rubrics r
        JOIN rubric_domains rd_link ON rd_link.rubric_id = r.id
        JOIN agent_domains adom ON adom.domain_id = rd_link.domain_id
        JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
        JOIN agents a ON a.id = adom.agent_id
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    ) filtered_agents
),
-- Auto-select default agents when there's only one option for each role
valid_hint_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('message' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_simulation_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('scenario' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_voice_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('message' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_member_agents AS (
    SELECT DISTINCT a.id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    UNION
    -- Get rubric agents (member role) from rubric_domains
    SELECT DISTINCT a.id
    FROM rubrics r
    JOIN rubric_domains rd_link ON rd_link.rubric_id = r.id
    JOIN agent_domains adom ON adom.domain_id = rd_link.domain_id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('agent' AS artifacts)
    JOIN agents a ON a.id = adom.agent_id
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true) 
    AND EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags fl ON rf.flag_id = fl.id WHERE rf.rubric_id = r.id AND fl.name = 'active' AND rf.type = 'active'::type_rubric_flags AND rf.value = true)
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
)
SELECT 
    up.actor_name::text as actor_name,
    -- Default values for new simulation (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'title' FROM draft_payload_data),
        ''::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
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
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN NULL::uuid[]
            ELSE COALESCE(ARRAY[pdi.department_id], ARRAY[]::uuid[])
        END
    ) as department_ids,
    COALESCE(dd.department_ids::uuid[], ARRAY[]::uuid[]) as valid_department_ids,
    0 as time_limit,
    NULL::uuid as rubric_id,
    COALESCE(rd.rubric_ids::uuid[], ARRAY[]::uuid[]) as valid_rubric_ids,
    -- Extract scenario_ids from draft payload if available
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
        ARRAY[]::uuid[]
    ) as scenario_ids,
    COALESCE(vs.ids::uuid[], ARRAY[]::uuid[]) as valid_scenario_ids,
    ARRAY[]::uuid[] as video_ids,
    COALESCE(vv.ids::uuid[], ARRAY[]::uuid[]) as valid_video_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true
    ) as active,
    COALESCE(
        (SELECT (payload->>'practiceSimulation')::boolean FROM draft_payload_data),
        (SELECT (payload->>'practice_simulation')::boolean FROM draft_payload_data),
        false
    ) as practice_simulation,
    -- Auto-select agents: draft payload -> default from SQL (if only one option) -> NULL
    COALESCE(
        (SELECT (payload->>'simulation_text_agent_id')::uuid FROM draft_payload_data),
        (SELECT id FROM default_simulation_agent),
        NULL::uuid
    ) as simulation_text_agent_id,
    COALESCE(
        (SELECT (payload->>'simulation_voice_agent_id')::uuid FROM draft_payload_data),
        (SELECT id FROM default_voice_agent),
        NULL::uuid
    ) as simulation_voice_agent_id,
    -- Auto-select member agent: draft payload -> default from SQL (if only one option) -> NULL
    COALESCE(
        (SELECT (payload->>'member_agent_id')::uuid FROM draft_payload_data),
        (SELECT id FROM default_member_agent),
        NULL::uuid
    ) as member_agent_id,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_duplicate,
    false as can_delete,
    false as in_use,
    0::bigint as cohort_count,
    ARRAY[]::types.q_get_simulation_new_v4_scenario[] as scenarios,
    COALESCE(vd.videos, ARRAY[]::types.q_get_simulation_new_v4_video[]) as videos,
    COALESCE(pild.parameter_items, ARRAY[]::types.q_get_simulation_new_v4_parameter_item[]) as parameters,
    COALESCE(pild.parameter_item_details, ARRAY[]::types.q_get_simulation_new_v4_parameter_item_detail[]) as parameter_items,
    COALESCE(sfd.scenarios_full, ARRAY[]::types.q_get_simulation_new_v4_scenario_full[]) as scenarios_full,
    COALESCE(rd.rubrics, ARRAY[]::types.q_get_simulation_new_v4_rubric[]) as rubrics,
    COALESCE(dd.departments, ARRAY[]::types.q_get_simulation_new_v4_department[]) as departments,
    COALESCE(pfd.parameters, ARRAY[]::types.q_get_simulation_new_v4_parameter[]) as parameters_full,
    COALESCE(fd.fields, ARRAY[]::types.q_get_simulation_new_v4_field[]) as fields,
    COALESCE(ad.agents, ARRAY[]::types.q_get_simulation_new_v4_agent[]) as agents,
    COALESCE(ad.agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    pdi.department_id as primary_department_id,
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