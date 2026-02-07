-- Unified save rubric function - handles both create (rubric_id = NULL) and update (rubric_id provided)
-- Accepts all resource IDs directly (not draft_id) following persona save pattern

-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_rubric_v4(
    profile_id uuid,
    group_id uuid,
    input_rubric_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    total_points_id uuid DEFAULT NULL,
    pass_points_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    standard_group_ids uuid[] DEFAULT NULL,
    standard_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    rubric_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_rubric_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_rubric_id IS NULL);

    -- Create or UPDATE rubric_artifact first
    IF is_create THEN
        INSERT INTO rubric_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_rubric_id;
    ELSE
        v_rubric_id := input_rubric_id;
        UPDATE rubric_artifact
        SET updated_at = NOW()
        WHERE id = v_rubric_id;
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

    IF total_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = total_points_id) THEN
        RAISE EXCEPTION 'Total points resource not found: %', total_points_id;
    END IF;

    IF pass_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = pass_points_id) THEN
        RAISE EXCEPTION 'Pass points resource not found: %', pass_points_id;
    END IF;

    -- Validate standard_group_ids exist
    IF COALESCE(array_length(standard_group_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(standard_group_ids) AS sg_id
            WHERE NOT EXISTS (SELECT 1 FROM standard_groups_resource WHERE id = sg_id)
        ) THEN
            RAISE EXCEPTION 'One or more standard_group_ids not found';
        END IF;
    END IF;

    IF COALESCE(array_length(standard_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(standard_ids) AS std_id
            WHERE NOT EXISTS (SELECT 1 FROM standards_resource WHERE id = std_id)
        ) THEN
            RAISE EXCEPTION 'One or more standard_ids not found';
        END IF;
    END IF;

    -- For update, remove old links first
    IF NOT is_create THEN
        DELETE FROM rubric_names_junction WHERE rubric_names_junction.rubric_id = v_rubric_id;
        DELETE FROM rubric_descriptions_junction WHERE rubric_descriptions_junction.rubric_id = v_rubric_id;
        DELETE FROM rubric_points_junction WHERE rubric_points_junction.rubric_id = v_rubric_id;
        DELETE FROM rubric_departments_junction WHERE rubric_departments_junction.rubric_id = v_rubric_id;
        -- Deactivate (don't delete) standard_group links
        UPDATE rubric_standard_groups_junction SET active = false
        WHERE rubric_standard_groups_junction.rubric_id = v_rubric_id AND rubric_standard_groups_junction.active = true;
        -- Deactivate (don't delete) standard links
        UPDATE rubric_standards_junction SET active = false
        WHERE rubric_standards_junction.rubric_id = v_rubric_id AND rubric_standards_junction.active = true;
        -- Update existing active flag if it exists
        UPDATE rubric_flags_junction SET
            flag_id = COALESCE(api_save_rubric_v4.active_flag_id, rubric_flags_junction.flag_id),
            value = CASE WHEN api_save_rubric_v4.active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE rubric_flags_junction.rubric_id = v_rubric_id;
    END IF;

    -- Continue with rubric save using SQL
    RETURN QUERY
    WITH params AS (
        SELECT
            v_rubric_id AS rubric_id,
            api_save_rubric_v4.name_id AS name_id,
            api_save_rubric_v4.description_id AS description_id,
            api_save_rubric_v4.active_flag_id AS active_flag_id,
            api_save_rubric_v4.total_points_id AS total_points_id,
            api_save_rubric_v4.pass_points_id AS pass_points_id,
            COALESCE(api_save_rubric_v4.department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(api_save_rubric_v4.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
            COALESCE(api_save_rubric_v4.standard_ids, ARRAY[]::uuid[]) AS standard_ids,
            api_save_rubric_v4.profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, view_user_profile_context.actor_name
        FROM view_user_profile_context
        WHERE view_user_profile_context.profile_id = (SELECT p.profile_id FROM params p)
    ),
    -- Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(rdj.department_id::text), ARRAY[]::text[]) as department_ids
        FROM rubric_departments_junction rdj
        WHERE rdj.rubric_id = (SELECT p.rubric_id FROM params p LIMIT 1) AND rdj.active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(pdj.department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction pdj
        WHERE pdj.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND pdj.active = true
    ),
    validate_permissions AS (
        SELECT
            CASE
                WHEN (SELECT p.rubric_id FROM params p) IS NULL THEN
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link rubric to name
    link_rubric_name AS (
        INSERT INTO rubric_names_junction (rubric_id, name_id, created_at)
        SELECT
            x.rubric_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT rubric_names_pkey DO NOTHING
    ),
    -- Link rubric to description
    link_rubric_description AS (
        INSERT INTO rubric_descriptions_junction (rubric_id, description_id, created_at)
        SELECT
            x.rubric_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT rubric_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE rubric active flag
    insert_rubric_active_flag AS (
        INSERT INTO rubric_flags_junction (rubric_id, flag_id, value, created_at) SELECT x.rubric_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'rubric_active'
        ON CONFLICT ON CONSTRAINT rubric_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, rubric_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link total_points
    link_total_points AS (
        INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
        SELECT
            x.rubric_id,
            x.total_points_id,
            'total'::point_type,
            NOW()
        FROM params x
        WHERE x.total_points_id IS NOT NULL
        ON CONFLICT (rubric_id, point_id, type) DO NOTHING
    ),
    -- Link pass_points
    link_pass_points AS (
        INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
        SELECT
            x.rubric_id,
            x.pass_points_id,
            'pass'::point_type,
            NOW()
        FROM params x
        WHERE x.pass_points_id IS NOT NULL
        ON CONFLICT (rubric_id, point_id, type) DO NOTHING
    ),
    -- Link departments
    link_departments AS (
        INSERT INTO rubric_departments_junction (rubric_id, department_id, active, created_at)
        SELECT
            x.rubric_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT rubric_departments_pkey DO UPDATE SET
            active = true
    ),
    -- Link standard_groups with position
    standard_groups_with_position AS (
        SELECT
            sg_id,
            COALESCE(
                (SELECT rsg.position FROM rubric_standard_groups_junction rsg
                 WHERE rsg.rubric_id = (SELECT p2.rubric_id FROM params p2 LIMIT 1)
                   AND rsg.standard_group_id = sg_id
                   AND rsg.active = false
                 ORDER BY rsg.updated_at DESC LIMIT 1),
                (ROW_NUMBER() OVER (ORDER BY ordinality))::int
            ) as position
        FROM params x
        CROSS JOIN UNNEST(x.standard_group_ids) WITH ORDINALITY as sg_id
        WHERE COALESCE(array_length(x.standard_group_ids, 1), 0) > 0
    ),
    link_standard_groups AS (
        INSERT INTO rubric_standard_groups_junction (rubric_id, standard_group_id, position, active, created_at)
        SELECT
            x.rubric_id,
            sgwp.sg_id,
            sgwp.position,
            true,
            NOW()
        FROM params x
        CROSS JOIN standard_groups_with_position sgwp
        ON CONFLICT ON CONSTRAINT rubric_standard_groups_pkey DO UPDATE SET
            position = EXCLUDED.position,
            active = true
    ),
    -- Link standards
    link_standards AS (
        INSERT INTO rubric_standards_junction (rubric_id, standard_id, active, created_at)
        SELECT
            x.rubric_id,
            std_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.standard_ids) as std_id
        WHERE COALESCE(array_length(x.standard_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT rubric_standards_pkey DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE rubrics_resource r
        SET name = n.name,
            description = d.description
        FROM rubric_rubrics_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.rubrics_id = r.id
          AND j.rubric_id = p.rubric_id
        RETURNING r.id
    )
    SELECT
        x.rubric_id AS rubric_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
