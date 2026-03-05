-- Duplicate scenario - creates copy linking to existing resources (except name)
-- Only name gets " Copy" suffix, active flag set to FALSE
-- All other resources link to existing IDs
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_duplicate_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
-- No composite types needed for this simple endpoint

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_scenario_v4(
    scenario_id uuid,
    profile_id uuid,
    name_resource_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    session_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    scenario_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT scenario_id AS scenario_id, profile_id AS profile_id, group_id AS group_id
),
actor_profile AS (
    SELECT
        p.id as resolved_profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_scenario AS (
    SELECT
        s.id as source_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.names_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name,
        (SELECT sd.descriptions_id FROM scenario_descriptions_junction sd WHERE sd.scenario_id = s.id LIMIT 1) as descriptions_id,
        (SELECT sps.problem_statements_id FROM scenario_problem_statements_junction sps WHERE sps.scenario_id = s.id AND sps.active = true LIMIT 1) as problem_statements_id
    FROM params x
    JOIN scenario_artifact s ON s.id = x.scenario_id
),
-- Get all flag values from source scenario
source_flags AS (
    SELECT
        ss.source_id,
        (SELECT f.value FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = ss.source_id AND f.type = 'objectives_enabled' LIMIT 1) as objectives_enabled,
        (SELECT f.value FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = ss.source_id AND f.type = 'images_enabled' LIMIT 1) as images_enabled,
        (SELECT f.value FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = ss.source_id AND f.type = 'video_enabled' LIMIT 1) as video_enabled,
        (SELECT f.value FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = ss.source_id AND f.type = 'questions_enabled' LIMIT 1) as questions_enabled,
        (SELECT f.value FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = ss.source_id AND f.type = 'problem_statement_enabled' LIMIT 1) as problem_statement_enabled
    FROM source_scenario ss
),
-- Get multi-select resource IDs from source
source_personas AS (
    SELECT sp.persona_id, sp.active
    FROM params x
    JOIN scenario_personas_junction sp ON sp.scenario_id = x.scenario_id AND sp.active = true
),
source_documents AS (
    SELECT sd.document_id, sd.active
    FROM params x
    JOIN scenario_documents_junction sd ON sd.scenario_id = x.scenario_id AND sd.active = true
),
source_departments AS (
    SELECT sd.department_id, sd.active
    FROM params x
    JOIN scenario_departments_junction sd ON sd.scenario_id = x.scenario_id AND sd.active = true
),
source_parameter_fields AS (
    SELECT spf.parameter_fields_id, spf.active
    FROM params x
    JOIN scenario_parameter_fields_junction spf ON spf.scenario_id = x.scenario_id AND spf.active = true
),
source_objectives AS (
    SELECT so.objectives_id
    FROM params x
    JOIN scenario_objectives_junction so ON so.scenario_id = x.scenario_id
),
source_images AS (
    SELECT si.image_id
    FROM params x
    JOIN scenario_images_junction si ON si.scenario_id = x.scenario_id AND si.active = true
),
source_videos AS (
    SELECT sv.video_id
    FROM params x
    JOIN scenario_videos_junction sv ON sv.scenario_id = x.scenario_id AND sv.active = true
),
source_questions AS (
    SELECT sq.question_id
    FROM params x
    JOIN scenario_questions_junction sq ON sq.scenario_id = x.scenario_id AND sq.active = true
),
-- Get flag IDs
get_active_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'active' LIMIT 1
),
get_objectives_enabled_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'objectives_enabled' LIMIT 1
),
get_images_enabled_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'images_enabled' LIMIT 1
),
get_video_enabled_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'video_enabled' LIMIT 1
),
get_questions_enabled_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'questions_enabled' LIMIT 1
),
get_problem_statement_enabled_flag AS (
    SELECT id as flag_id FROM flags_resource WHERE name = 'problem_statement_enabled' LIMIT 1
),
-- Handle group
ensure_group AS (
    INSERT INTO groups_entry (id, created_at, session_id)
    SELECT p.group_id, NOW(), session_id
    FROM params p
    WHERE p.group_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM groups_entry g WHERE g.id = p.group_id)
    RETURNING id
),
new_group AS (
    INSERT INTO groups_entry (created_at, session_id)
    SELECT NOW(), session_id
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id
),
group_target AS (
    SELECT p.group_id AS group_id
    FROM params p
    WHERE p.group_id IS NOT NULL
    UNION ALL
    SELECT eg.id FROM ensure_group eg
    UNION ALL
    SELECT ng.id FROM new_group ng
    LIMIT 1
),
-- Create new scenario
new_scenario AS (
    INSERT INTO scenario_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM source_scenario ss
    CROSS JOIN group_target gt
    RETURNING id
),
-- Link name (name resource created by Python)
link_name AS (
    INSERT INTO scenario_names_junction (scenario_id, names_id, created_at)
    SELECT ns.id, name_resource_id, NOW()
    FROM new_scenario ns
    WHERE name_resource_id IS NOT NULL
),
-- Link existing description
link_description AS (
    INSERT INTO scenario_descriptions_junction (scenario_id, descriptions_id, created_at)
    SELECT ns.id, ss.descriptions_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_scenario ss
    WHERE ss.descriptions_id IS NOT NULL
),
-- Link existing problem statement
link_problem_statement AS (
    INSERT INTO scenario_problem_statements_junction (scenario_id, problem_statements_id, active, created_at)
    SELECT ns.id, ss.problem_statements_id, true, NOW()
    FROM new_scenario ns
    CROSS JOIN source_scenario ss
    WHERE ss.problem_statements_id IS NOT NULL
),
-- Link active flag (set to false for duplicate)
link_active_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, gaf.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN get_active_flag gaf
),
-- Link objectives_enabled flag (copy value from source)
link_objectives_enabled_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, goef.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_flags sf
    CROSS JOIN get_objectives_enabled_flag goef
    WHERE sf.objectives_enabled IS NOT NULL
),
-- Link images_enabled flag (copy value from source)
link_images_enabled_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, gief.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_flags sf
    CROSS JOIN get_images_enabled_flag gief
    WHERE sf.images_enabled IS NOT NULL
),
-- Link video_enabled flag (copy value from source)
link_video_enabled_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, gvef.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_flags sf
    CROSS JOIN get_video_enabled_flag gvef
    WHERE sf.video_enabled IS NOT NULL
),
-- Link questions_enabled flag (copy value from source)
link_questions_enabled_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, gqef.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_flags sf
    CROSS JOIN get_questions_enabled_flag gqef
    WHERE sf.questions_enabled IS NOT NULL
),
-- Link problem_statement_enabled flag (copy value from source)
link_problem_statement_enabled_flag AS (
    INSERT INTO scenario_flags_junction (scenario_id, flag_id, created_at)
    SELECT ns.id, gpsef.flag_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_flags sf
    CROSS JOIN get_problem_statement_enabled_flag gpsef
    WHERE sf.problem_statement_enabled IS NOT NULL
),
-- Link existing personas
copy_personas AS (
    INSERT INTO scenario_personas_junction (scenario_id, persona_id, active, created_at)
    SELECT ns.id, sp.persona_id, sp.active, NOW()
    FROM new_scenario ns
    CROSS JOIN source_personas sp
),
-- Link existing documents
copy_documents AS (
    INSERT INTO scenario_documents_junction (scenario_id, document_id, active, created_at)
    SELECT ns.id, sd.document_id, sd.active, NOW()
    FROM new_scenario ns
    CROSS JOIN source_documents sd
),
-- Link existing departments
copy_departments AS (
    INSERT INTO scenario_departments_junction (scenario_id, department_id, active, created_at)
    SELECT ns.id, sd.department_id, sd.active, NOW()
    FROM new_scenario ns
    CROSS JOIN source_departments sd
),
-- Link existing parameter fields
copy_parameter_fields AS (
    INSERT INTO scenario_parameter_fields_junction (scenario_id, parameter_fields_id, active, created_at)
    SELECT ns.id, spf.parameter_fields_id, spf.active, NOW()
    FROM new_scenario ns
    CROSS JOIN source_parameter_fields spf
),
-- Link existing objectives
copy_objectives AS (
    INSERT INTO scenario_objectives_junction (scenario_id, objectives_id, created_at)
    SELECT ns.id, so.objectives_id, NOW()
    FROM new_scenario ns
    CROSS JOIN source_objectives so
),
-- Link existing images
copy_images AS (
    INSERT INTO scenario_images_junction (scenario_id, image_id, active, created_at)
    SELECT ns.id, si.image_id, true, NOW()
    FROM new_scenario ns
    CROSS JOIN source_images si
),
-- Link existing videos
copy_videos AS (
    INSERT INTO scenario_videos_junction (scenario_id, video_id, active, created_at)
    SELECT ns.id, sv.video_id, true, NOW()
    FROM new_scenario ns
    CROSS JOIN source_videos sv
),
-- Link existing questions
copy_questions AS (
    INSERT INTO scenario_questions_junction (scenario_id, question_id, active, created_at)
    SELECT ns.id, sq.question_id, true, NOW()
    FROM new_scenario ns
    CROSS JOIN source_questions sq
)
SELECT
    ns.id as scenario_id,
    ss.name::text as scenario_name,
    ap.actor_name::text as actor_name
FROM new_scenario ns
CROSS JOIN source_scenario ss
CROSS JOIN actor_profile ap
$$;
