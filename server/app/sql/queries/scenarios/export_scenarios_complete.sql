-- Export scenarios with full resource IDs and values for round-trip CSV
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_export_scenarios_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_export_scenarios_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_export_scenarios_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_export_scenarios_v4_row AS (
    scenario_id uuid,
    -- Single-select: ID + value
    name_id uuid,
    name text,
    description_id uuid,
    description text,
    problem_statement_id uuid,
    problem_statement text,
    -- Boolean flags (derived from scenario_flags_junction)
    is_inactive boolean,
    -- Flags as ID array + name array (for round-trip)
    flag_ids uuid[],
    flags text[],
    -- Multi-select: ID arrays + value arrays
    department_ids uuid[],
    departments text[],
    persona_ids uuid[],
    personas text[],
    document_ids uuid[],
    documents text[],
    parameter_field_ids uuid[],
    parameter_fields text[],
    objective_ids uuid[],
    objectives text[],
    image_ids uuid[],
    images text[],
    video_ids uuid[],
    videos text[],
    question_ids uuid[],
    questions text[],
    option_ids uuid[],
    options text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_export_scenarios_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    rows types.q_export_scenarios_v4_row[]
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
-- Department data
scenario_departments_data AS (
    SELECT
        sd.scenario_id,
        ARRAY_AGG(sd.department_id ORDER BY sd.created_at) as department_ids,
        ARRAY_AGG(dr.name ORDER BY sd.created_at) as department_names
    FROM scenario_departments_junction sd
    JOIN departments_resource dr ON dr.id = sd.department_id
    WHERE sd.active = true
    GROUP BY sd.scenario_id
),
-- Persona data (persona_id -> personas_resource.name)
scenario_personas_data AS (
    SELECT
        spj.scenario_id,
        ARRAY_AGG(spj.persona_id ORDER BY spj.created_at) as persona_ids,
        ARRAY_AGG(pr.name ORDER BY spj.created_at) as persona_names
    FROM scenario_personas_junction spj
    JOIN personas_resource pr ON pr.id = spj.persona_id
    WHERE spj.active = true
    GROUP BY spj.scenario_id
),
-- Document data
scenario_documents_data AS (
    SELECT
        sdj.scenario_id,
        ARRAY_AGG(sdj.document_id ORDER BY sdj.created_at) as document_ids,
        ARRAY_AGG(dr.name ORDER BY sdj.created_at) as document_names
    FROM scenario_documents_junction sdj
    JOIN documents_resource dr ON dr.id = sdj.document_id
    WHERE sdj.active = true
    GROUP BY sdj.scenario_id
),
-- Parameter field data (parameter_field_id -> fields_resource.name via parameter_fields_resource.field_id)
scenario_pf_data AS (
    SELECT
        spfj.scenario_id,
        ARRAY_AGG(spfj.parameter_field_id ORDER BY spfj.created_at) as parameter_field_ids,
        ARRAY_AGG(fr.name ORDER BY spfj.created_at) as parameter_field_names
    FROM scenario_parameter_fields_junction spfj
    JOIN parameter_fields_resource pfr ON pfr.id = spfj.parameter_field_id
    JOIN fields_resource fr ON fr.id = pfr.field_id
    WHERE spfj.active = true
    GROUP BY spfj.scenario_id
),
-- Objective data (ordered by idx)
scenario_objectives_data AS (
    SELECT
        soj.scenario_id,
        ARRAY_AGG(soj.objective_id) as objective_ids,
        ARRAY_AGG(obr.objective) as objective_values
    FROM scenario_objectives_junction soj
    JOIN objectives_resource obr ON obr.id = soj.objective_id
    WHERE soj.active = true
    GROUP BY soj.scenario_id
),
-- Image data
scenario_images_data AS (
    SELECT
        sij.scenario_id,
        ARRAY_AGG(sij.image_id ORDER BY sij.created_at) as image_ids,
        ARRAY_AGG(ir.name ORDER BY sij.created_at) as image_names
    FROM scenario_images_junction sij
    JOIN images_resource ir ON ir.id = sij.image_id
    WHERE sij.active = true
    GROUP BY sij.scenario_id
),
-- Video data
scenario_videos_data AS (
    SELECT
        svj.scenario_id,
        ARRAY_AGG(svj.video_id ORDER BY svj.created_at) as video_ids,
        ARRAY_AGG(vr.name ORDER BY svj.created_at) as video_names
    FROM scenario_videos_junction svj
    JOIN videos_resource vr ON vr.id = svj.video_id
    WHERE svj.active = true
    GROUP BY svj.scenario_id
),
-- Question data
scenario_questions_data AS (
    SELECT
        sqj.scenario_id,
        ARRAY_AGG(sqj.question_id ORDER BY sqj.created_at) as question_ids,
        ARRAY_AGG(qr.question_text ORDER BY sqj.created_at) as question_texts
    FROM scenario_questions_junction sqj
    JOIN questions_resource qr ON qr.id = sqj.question_id
    WHERE sqj.active = true
    GROUP BY sqj.scenario_id
),
-- Option data
scenario_options_data AS (
    SELECT
        soj.scenario_id,
        ARRAY_AGG(soj.option_id ORDER BY soj.created_at) as option_ids,
        ARRAY_AGG(opr.option_text ORDER BY soj.created_at) as option_texts
    FROM scenario_options_junction soj
    JOIN options_resource opr ON opr.id = soj.option_id
    WHERE soj.active = true
    GROUP BY soj.scenario_id
),
-- Flags data (all flags as array, with names)
scenario_flags_data AS (
    SELECT
        sfj.scenario_id,
        ARRAY_AGG(sfj.flag_id ORDER BY sfj.created_at) FILTER (WHERE fr.value = true) as flag_ids,
        ARRAY_AGG(fr.name ORDER BY sfj.created_at) FILTER (WHERE fr.value = true) as flag_names
    FROM scenario_flags_junction sfj
    JOIN flags_resource fr ON fr.id = sfj.flag_id
    WHERE sfj.active = true
    GROUP BY sfj.scenario_id
),
-- Simulation linkage for filtering (via denormalized simulations_resource.scenario_ids)
scenario_simulations AS (
    SELECT
        ssj.scenario_id,
        ARRAY_AGG(DISTINCT sim_r.id) as simulation_ids
    FROM scenario_scenarios_junction ssj
    JOIN scenarios_resource sr ON sr.id = ssj.scenarios_id
    JOIN simulations_resource sim_r ON sr.id = ANY(sim_r.scenario_ids)
    GROUP BY ssj.scenario_id
),
-- Main scenario data
scenario_data AS (
    SELECT
        s.id as scenario_id,
        -- Name
        (SELECT sn.name_id FROM scenario_names_junction sn WHERE sn.scenario_id = s.id AND sn.active = true LIMIT 1) as name_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id AND sn.active = true LIMIT 1) as name,
        -- Description
        (SELECT sd.description_id FROM scenario_descriptions_junction sd WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as description_id,
        (SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as description,
        -- Problem statement
        (SELECT sps.problem_statement_id FROM scenario_problem_statements_junction sps WHERE sps.scenario_id = s.id AND sps.active = true LIMIT 1) as problem_statement_id,
        (SELECT ps.problem_statement FROM scenario_problem_statements_junction sps JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id WHERE sps.scenario_id = s.id AND sps.active = true LIMIT 1) as problem_statement,
        -- Flags
        NOT EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.type = 'scenario_active' AND f.value = TRUE AND sf.active = true) as is_inactive,
        sfd.flag_ids,
        sfd.flag_names as flags,
        -- Multi-select
        sdd.department_ids,
        sdd.department_names as departments,
        spd.persona_ids,
        spd.persona_names as personas,
        sdod.document_ids,
        sdod.document_names as documents,
        spfd.parameter_field_ids,
        spfd.parameter_field_names as parameter_fields,
        sod.objective_ids,
        sod.objective_values as objectives,
        sid.image_ids,
        sid.image_names as images,
        svd.video_ids,
        svd.video_names as videos,
        sqd.question_ids,
        sqd.question_texts as questions,
        sopd.option_ids,
        sopd.option_texts as options,
        -- For filtering
        s.updated_at,
        COALESCE(spd.persona_ids, ARRAY[]::uuid[]) as f_persona_ids,
        COALESCE(ssim.simulation_ids, ARRAY[]::uuid[]) as f_simulation_ids
    FROM scenario_artifact s
    LEFT JOIN scenario_departments_junction sdj ON sdj.scenario_id = s.id AND sdj.active = true
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    LEFT JOIN scenario_personas_data spd ON spd.scenario_id = s.id
    LEFT JOIN scenario_documents_data sdod ON sdod.scenario_id = s.id
    LEFT JOIN scenario_pf_data spfd ON spfd.scenario_id = s.id
    LEFT JOIN scenario_objectives_data sod ON sod.scenario_id = s.id
    LEFT JOIN scenario_images_data sid ON sid.scenario_id = s.id
    LEFT JOIN scenario_videos_data svd ON svd.scenario_id = s.id
    LEFT JOIN scenario_questions_data sqd ON sqd.scenario_id = s.id
    LEFT JOIN scenario_options_data sopd ON sopd.scenario_id = s.id
    LEFT JOIN scenario_flags_data sfd ON sfd.scenario_id = s.id
    LEFT JOIN scenario_simulations ssim ON ssim.scenario_id = s.id
    GROUP BY s.id, s.updated_at,
        sdd.department_ids, sdd.department_names,
        spd.persona_ids, spd.persona_names,
        sdod.document_ids, sdod.document_names,
        spfd.parameter_field_ids, spfd.parameter_field_names,
        sod.objective_ids, sod.objective_values,
        sid.image_ids, sid.image_names,
        svd.video_ids, svd.video_names,
        sqd.question_ids, sqd.question_texts,
        sopd.option_ids, sopd.option_texts,
        sfd.flag_ids, sfd.flag_names,
        ssim.simulation_ids
    HAVING
        COUNT(sdj.scenario_id) FILTER (WHERE sdj.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM scenario_departments_junction sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
),
-- Apply filters
filtered_scenarios AS (
    SELECT sd.*
    FROM scenario_data sd
    WHERE
        (search IS NULL OR LOWER(sd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(sd.problem_statement) LIKE '%' || LOWER(search) || '%')
        AND (api_export_scenarios_v4.persona_ids IS NULL OR sd.f_persona_ids && api_export_scenarios_v4.persona_ids)
        AND (api_export_scenarios_v4.simulation_ids IS NULL OR sd.f_simulation_ids && api_export_scenarios_v4.simulation_ids)
        AND (filter_department_ids IS NULL OR sd.department_ids::text[] && filter_department_ids::text[])
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (fs.scenario_id,
             fs.name_id, fs.name,
             fs.description_id, fs.description,
             fs.problem_statement_id, fs.problem_statement,
             fs.is_inactive,
             fs.flag_ids, fs.flags,
             fs.department_ids, fs.departments,
             fs.persona_ids, fs.personas,
             fs.document_ids, fs.documents,
             fs.parameter_field_ids, fs.parameter_fields,
             fs.objective_ids, fs.objectives,
             fs.image_ids, fs.images,
             fs.video_ids, fs.videos,
             fs.question_ids, fs.questions,
             fs.option_ids, fs.options
            )::types.q_export_scenarios_v4_row
            ORDER BY fs.updated_at DESC NULLS LAST
        ) FROM filtered_scenarios fs),
        '{}'::types.q_export_scenarios_v4_row[]
    ) as rows
FROM params
$$;
