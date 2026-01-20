-- Unified save simulation function - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided)
-- Converted to function following personas/save_persona_complete.sql pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_save_simulation_v4(
    name_id uuid,
    department_ids uuid[],
    scenario_ids uuid[],  -- Scenario resource IDs (FROM scenarios_resource resource table)
    scenario_active_flags boolean[],
    scenario_hints_enabled boolean[],
    scenario_time_limit_seconds int[],
    scenario_audio_enabled boolean[],
    scenario_text_enabled boolean[],
    profile_id uuid,
    input_simulation_id uuid DEFAULT NULL,  -- NULL = create, UUID = update
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    practice_simulation boolean DEFAULT false,
    -- New scenario resource parameters (optional, for future use)
    scenario_flag_ids uuid[] DEFAULT NULL,  -- Simulation scenario flag resource IDs
    scenario_position_ids uuid[] DEFAULT NULL,  -- Scenario position resource IDs (junction table entries)
    scenario_rubric_ids uuid[] DEFAULT NULL,  -- Scenario rubric resource IDs
    -- Update-only params (optional, only used in update mode)
    video_ids uuid[] DEFAULT NULL,
    video_active_flags boolean[] DEFAULT NULL,
    video_show_problem_statement boolean[] DEFAULT NULL,
    video_show_objectives boolean[] DEFAULT NULL,
    video_show_image boolean[] DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_simulation_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_simulation_id IS NULL);
    
    -- Create or UPDATE simulation_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO simulation_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_simulation_id;
    ELSE
        -- UPDATE path
        v_simulation_id := input_simulation_id;
        UPDATE simulation_artifact
        SET updated_at = NOW()
        WHERE id = v_simulation_id;
        
        -- Check if simulation exists
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulation not found: %', input_simulation_id;
        END IF;
    END IF;
    
    -- Validate required resource IDs exist
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM simulation_names WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_descriptions WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_departments WHERE simulation_id = v_simulation_id;
        -- Update existing active flag if it exists
        UPDATE simulation_flags SET
            flag_id = COALESCE(api_save_simulation_v4.active_flag_id, simulation_flags.flag_id),
            value = CASE WHEN api_save_simulation_v4.active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE simulation_id = v_simulation_id
          ;
    END IF;
    
    -- Continue with simulation save using SQL (simulation already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_simulation_id AS simulation_id,
            name_id,
            description_id,
            active_flag_id,
            practice_simulation,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
            COALESCE(scenario_active_flags, ARRAY[]::boolean[]) AS scenario_active_flags,
            COALESCE(scenario_hints_enabled, ARRAY[]::boolean[]) AS scenario_hints_enabled,
            COALESCE(scenario_time_limit_seconds, ARRAY[]::int[]) AS scenario_time_limit_seconds,
            COALESCE(scenario_audio_enabled, ARRAY[]::boolean[]) AS scenario_audio_enabled,
            COALESCE(scenario_text_enabled, ARRAY[]::boolean[]) AS scenario_text_enabled,
            COALESCE(scenario_rubric_ids, ARRAY[]::uuid[]) AS scenario_rubric_ids,
            profile_id,
            COALESCE(video_ids, ARRAY[]::uuid[]) AS video_ids,
            COALESCE(video_active_flags, ARRAY[]::boolean[]) AS video_active_flags,
            COALESCE(video_show_problem_statement, ARRAY[]::boolean[]) AS video_show_problem_statement,
            COALESCE(video_show_objectives, ARRAY[]::boolean[]) AS video_show_objectives,
            COALESCE(video_show_image, ARRAY[]::boolean[]) AS video_show_image
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM simulation_departments
        WHERE simulation_departments.simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.simulation_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    assert_permissions AS (
        SELECT 1
        FROM validate_permissions
        WHERE validation_passed = true
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link simulation name (resource ID already validated)
    link_simulation_name AS (
        INSERT INTO simulation_names (simulation_id, name_id, created_at, updated_at)
        SELECT 
            x.simulation_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT (simulation_id, name_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Link simulation description (resource ID already validated)
    link_simulation_description AS (
        INSERT INTO simulation_descriptions (simulation_id, description_id, created_at, updated_at)
        SELECT 
            x.simulation_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT (simulation_id, description_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Link simulation active flag (resource ID already validated)
    link_simulation_active_flag AS (
        INSERT INTO simulation_flags (simulation_id, flag_id, value, created_at, updated_at) SELECT x.simulation_id,
            x.active_flag_id,
            true,
            NOW(),
            NOW()
        FROM params x
        WHERE x.active_flag_id IS NOT NULL
        ON CONFLICT (simulation_id, flag_id, type) DO UPDATE SET 
            flag_id = EXCLUDED.flag_id,
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- UPDATE simulation_artifact practice flag
    update_simulation_practice_flag AS (
        DELETE FROM simulation_flags 
        WHERE simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1)
          
        AND (SELECT p.simulation_id FROM params p LIMIT 1) IS NOT NULL
    ),
    link_simulation_practice_flag AS (
        INSERT INTO simulation_flags (simulation_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.simulation_id,
            (SELECT id FROM flags_resource WHERE name = 'practice' LIMIT 1),
            x.practice_simulation,
            NOW(),
            NOW()
        FROM params x
        WHERE x.practice_simulation IS NOT NULL
        ON CONFLICT (simulation_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    replace_time_limits AS (
        DELETE FROM scenario_time_limits 
        WHERE simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1)
    ),
    replace_departments AS (
        UPDATE simulation_departments 
        SET active = false, updated_at = NOW()
        WHERE simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1) AND active = true
        AND (SELECT p.simulation_id FROM params p LIMIT 1) IS NOT NULL
    ),
    link_departments AS (
        INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
        SELECT 
            x.simulation_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE array_length(x.department_ids, 1) > 0
        ON CONFLICT (simulation_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    replace_scenarios AS (
        DELETE FROM simulation_scenarios 
        WHERE simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1)
        AND (SELECT p.simulation_id FROM params p LIMIT 1) IS NOT NULL
    ),
    -- Convert scenario resource IDs to artifact IDs
    scenario_resource_to_artifact AS (
        SELECT 
            s.id as scenario_resource_id,
            s.scenario_id as scenario_artifact_id
        FROM scenarios_resource s
        WHERE s.id = ANY((SELECT scenario_ids FROM params LIMIT 1))
          AND s.active = true
    ),
    scenarios_data AS (
        SELECT DISTINCT
            srta.scenario_artifact_id as scenario_id,
            active_flag,
            hints_enabled,
            audio_enabled,
            text_enabled,
            time_limit_seconds,
            row_num
        FROM (
            SELECT 
                scenario_resource_id,
                active_flag,
                COALESCE(hints_enabled, false) as hints_enabled,
                COALESCE(audio_enabled, false) as audio_enabled,
                COALESCE(text_enabled, true) as text_enabled,
                time_limit_seconds,
                ROW_NUMBER() OVER () as row_num
            FROM params x
            CROSS JOIN UNNEST(
                x.scenario_ids, 
                x.scenario_active_flags, 
                x.scenario_hints_enabled,
                x.scenario_audio_enabled,
                x.scenario_text_enabled,
                x.scenario_time_limit_seconds
            ) AS t(scenario_resource_id, active_flag, hints_enabled, audio_enabled, text_enabled, time_limit_seconds)
        ) sub
        JOIN scenario_resource_to_artifact srta ON srta.scenario_resource_id = sub.scenario_resource_id
    ),
    scenarios_with_order AS (
        SELECT 
            scenario_id,
            active_flag,
            hints_enabled,
            audio_enabled,
            text_enabled,
            time_limit_seconds,
            ROW_NUMBER() OVER (
                ORDER BY active_flag DESC, row_num
            ) as position
        FROM scenarios_data
        WHERE EXISTS (SELECT 1 FROM params x WHERE array_length(x.scenario_ids, 1) > 0)
    ),
    link_time_limits AS (
        INSERT INTO scenario_time_limits (simulation_id, scenario_id, time_limit_seconds, active, created_at, updated_at)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            swo.time_limit_seconds,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN scenarios_with_order swo
        WHERE swo.time_limit_seconds IS NOT NULL 
          AND swo.time_limit_seconds > 0
          AND swo.active_flag = true
        ON CONFLICT (simulation_id, scenario_id) DO UPDATE SET
            time_limit_seconds = EXCLUDED.time_limit_seconds,
            active = EXCLUDED.active,
            updated_at = NOW()
    ),
    scenario_count AS (
        SELECT COALESCE(MAX(position), 0) as max_position
        FROM scenarios_with_order
    ),
    videos_data AS (
        SELECT 
            video_id,
            active_flag,
            show_problem_statement,
            show_objectives,
            show_image,
            row_num
        FROM (
            SELECT 
                video_id,
                active_flag,
                COALESCE(show_problem_statement, true) as show_problem_statement,
                COALESCE(show_objectives, true) as show_objectives,
                COALESCE(show_image, true) as show_image,
                ROW_NUMBER() OVER () as row_num
            FROM params x
            CROSS JOIN UNNEST(
                x.video_ids, 
                x.video_active_flags, 
                x.video_show_problem_statement,
                x.video_show_objectives,
                x.video_show_image
            ) AS t(video_id, active_flag, show_problem_statement, show_objectives, show_image)
            WHERE array_length(x.video_ids, 1) > 0
        ) sub
    ),
    videos_with_order AS (
        SELECT 
            vd.video_id,
            vd.active_flag,
            vd.show_problem_statement,
            vd.show_objectives,
            vd.show_image,
            sc.max_position + ROW_NUMBER() OVER (
                ORDER BY vd.active_flag DESC, vd.row_num
            ) as position
        FROM videos_data vd
        CROSS JOIN scenario_count sc
        WHERE EXISTS (SELECT 1 FROM params x WHERE array_length(x.video_ids, 1) > 0)
    ),
    link_scenarios AS (
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, position, created_at, updated_at)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            swo.position,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN scenarios_with_order swo
        ON CONFLICT (simulation_id, scenario_id) DO UPDATE SET
            position = EXCLUDED.position,
            updated_at = NOW()
    ),
    get_flag_resource_ids AS (
        SELECT 
            (SELECT id FROM simulation_scenario_flags WHERE name = 'active' LIMIT 1) as active_flag_id,
            (SELECT id FROM simulation_scenario_flags WHERE name = 'hints_enabled' LIMIT 1) as hints_enabled_flag_id,
            (SELECT id FROM simulation_scenario_flags WHERE name = 'audio_enabled' LIMIT 1) as audio_enabled_flag_id,
            (SELECT id FROM simulation_scenario_flags WHERE name = 'text_enabled' LIMIT 1) as text_enabled_flag_id
    ),
    link_scenario_flags AS (
        INSERT INTO simulation_scenario_flags (simulation_id, scenario_id, scenario_flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            gfri.active_flag_id,
            swo.active_flag,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN scenarios_with_order swo
        CROSS JOIN get_flag_resource_ids gfri
        WHERE gfri.active_flag_id IS NOT NULL
        ON CONFLICT (simulation_id, scenario_id, scenario_flag_id, type) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    link_scenario_flags_hints AS (
        INSERT INTO simulation_scenario_flags (simulation_id, scenario_id, scenario_flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            gfri.hints_enabled_flag_id,
            swo.hints_enabled,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN scenarios_with_order swo
        CROSS JOIN get_flag_resource_ids gfri
        WHERE gfri.hints_enabled_flag_id IS NOT NULL
        ON CONFLICT (simulation_id, scenario_id, scenario_flag_id, type) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    link_scenario_flags_audio AS (
        INSERT INTO simulation_scenario_flags (simulation_id, scenario_id, scenario_flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            gfri.audio_enabled_flag_id,
            swo.audio_enabled,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN scenarios_with_order swo
        CROSS JOIN get_flag_resource_ids gfri
        WHERE gfri.audio_enabled_flag_id IS NOT NULL
        ON CONFLICT (simulation_id, scenario_id, scenario_flag_id, type) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    link_scenario_flags_text AS (
        INSERT INTO simulation_scenario_flags (simulation_id, scenario_id, scenario_flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            swo.scenario_id,
            gfri.text_enabled_flag_id,
            swo.text_enabled,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN scenarios_with_order swo
        CROSS JOIN get_flag_resource_ids gfri
        WHERE gfri.text_enabled_flag_id IS NOT NULL
        ON CONFLICT (simulation_id, scenario_id, scenario_flag_id, type) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    link_scenario_flag_resources AS (
        INSERT INTO simulation_scenario_flags (
            simulation_id,
            scenario_flag_id,
            value,
            created_at,
            updated_at,
            generated,
            mcp,
            active
        )
        SELECT DISTINCT
            x.simulation_id,
            sfid,
            true,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_flag_ids) AS sfid
        WHERE sfid IS NOT NULL
        ON CONFLICT (simulation_id, scenario_flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW(),
            active = true
    ),
    remove_existing_scenario_rubrics AS (
        DELETE FROM simulation_scenario_rubrics
        WHERE simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1)
    ),
    link_scenario_rubrics AS (
        INSERT INTO simulation_scenario_rubrics (simulation_id, scenario_rubric_id, created_at, updated_at, generated, mcp, active)
        SELECT DISTINCT
            x.simulation_id,
            srid,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_rubric_ids) AS srid
        WHERE srid IS NOT NULL
        ON CONFLICT (simulation_id, scenario_rubric_id) DO UPDATE SET
            updated_at = NOW(),
            active = true
    )
    SELECT 
        x.simulation_id AS simulation_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap
    CROSS JOIN assert_permissions ap_check;
END;
$$;
