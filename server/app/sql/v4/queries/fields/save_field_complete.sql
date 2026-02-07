-- Unified save field function - handles both create (input_field_id = NULL) and update (input_field_id provided)
-- Accepts resource IDs directly (no raw values)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_field_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with resource ID parameters
CREATE OR REPLACE FUNCTION api_save_field_v4(
    profile_id uuid,
    group_id uuid,
    input_field_id uuid DEFAULT NULL,
    -- Required form data
    name_id uuid DEFAULT NULL,
    -- Optional single-select form data
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    -- Optional multi-select form data
    department_ids uuid[] DEFAULT NULL,
    parameter_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    field_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_field_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_field_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_parameter_ids uuid[];
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_field_id := input_field_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_active_flag_id := active_flag_id;
    v_department_ids := COALESCE(department_ids, ARRAY[]::uuid[]);
    v_parameter_ids := COALESCE(parameter_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_field_id IS NULL);

    -- Create or UPDATE field_artifact first
    IF is_create THEN
        -- CREATE path
        INSERT INTO field_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_field_id;
        -- Link group via junction table
        INSERT INTO field_groups_junction (field_id, group_id)
        VALUES (v_field_id, v_group_id)
        ON CONFLICT DO NOTHING;
    ELSE
        -- UPDATE path
        v_field_id := v_input_field_id;
        UPDATE field_artifact
        SET updated_at = NOW()
        WHERE id = v_field_id;
        -- Upsert group via junction table
        INSERT INTO field_groups_junction (field_id, group_id)
        VALUES (v_field_id, v_group_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Validate resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    -- Conditional: For update, remove old links first
    IF NOT is_create THEN
        DELETE FROM field_names_junction WHERE field_id = v_field_id;
        DELETE FROM field_descriptions_junction WHERE field_id = v_field_id;
        DELETE FROM field_departments_junction WHERE field_id = v_field_id;
        UPDATE field_conditional_parameters_junction SET active = false WHERE field_id = v_field_id;
        -- Update existing active flag if it exists
        UPDATE field_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, field_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE field_id = v_field_id;
    END IF;

    -- Continue with field save using SQL (field already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_field_id AS field_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_department_ids AS department_ids,
            v_parameter_ids AS parameter_ids,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Permission validation is now handled in Python (permissions.py)
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link field to name
    link_field_name AS (
        INSERT INTO field_names_junction (field_id, name_id, created_at)
        SELECT
            x.field_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT (field_id, name_id) DO NOTHING
    ),
    -- Link field to description
    link_field_description AS (
        INSERT INTO field_descriptions_junction (field_id, description_id, created_at)
        SELECT
            x.field_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT (field_id, description_id) DO NOTHING
    ),
    -- Insert or UPDATE field active flag
    insert_field_active_flag AS (
        INSERT INTO field_flags_junction (field_id, flag_id, type, value, created_at) SELECT x.field_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_field_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'field_active'
        ON CONFLICT (field_id, flag_id, type) DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, field_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Ensure conditional_parameters_resource entries exist for each parameter
    ensure_conditional_parameters AS (
        INSERT INTO conditional_parameters_resource (parameter_id, created_at, updated_at)
        SELECT param_id, NOW(), NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_ids) as param_id
        WHERE COALESCE(array_length(x.parameter_ids, 1), 0) > 0
        ON CONFLICT (parameter_id) DO NOTHING
        RETURNING id, parameter_id
    ),
    -- Link conditional parameters
    link_conditional_parameters AS (
        INSERT INTO field_conditional_parameters_junction (field_id, conditional_parameter_id, active, created_at)
        SELECT
            x.field_id,
            cpr.id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.parameter_ids) as param_id
        JOIN conditional_parameters_resource cpr ON cpr.parameter_id = param_id
        WHERE COALESCE(array_length(x.parameter_ids, 1), 0) > 0
        ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
            active = true
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO field_departments_junction (field_id, department_id, active, created_at)
        SELECT
            x.field_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT (field_id, department_id) DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE fields_resource r
        SET name = n.name,
            description = d.description
        FROM field_fields_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.fields_id = r.id
          AND j.field_id = p.field_id
        RETURNING r.id
    )
    SELECT
        x.field_id AS field_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
