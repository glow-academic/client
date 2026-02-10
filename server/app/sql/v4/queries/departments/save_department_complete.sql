-- Unified save department function - handles both create (department_id = NULL) and update (department_id provided)
-- Accepts form fields directly (no draft_id dependency) - follows persona gold standard pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with direct form data parameters (no draft_id)
CREATE OR REPLACE FUNCTION api_save_department_v4(
    profile_id uuid,
    group_id uuid,
    input_department_id uuid DEFAULT NULL,
    -- Required form data
    name_id uuid DEFAULT NULL,
    -- Optional single-select form data
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    -- Optional multi-select form data
    settings_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    department_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_department_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_department_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_settings_ids uuid[];
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_department_id := input_department_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_active_flag_id := active_flag_id;
    v_settings_ids := COALESCE(settings_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_department_id IS NULL);

    -- Create or UPDATE department_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO department_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_department_id;
    ELSE
        -- UPDATE path
        v_department_id := v_input_department_id;
        UPDATE department_artifact
        SET updated_at = NOW()
        WHERE id = v_department_id;
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

    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM department_names_junction WHERE department_id = v_department_id;
        DELETE FROM department_descriptions_junction WHERE department_id = v_department_id;
        -- Update existing active flag if it exists
        UPDATE department_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, department_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE department_id = v_department_id;
        -- Clear old settings links
        DELETE FROM department_settings_junction WHERE department_id = v_department_id;
    END IF;

    -- Continue with department save using SQL (department already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_department_id AS department_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_settings_ids AS settings_ids,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
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
    -- Link department to name
    link_department_name AS (
        INSERT INTO department_names_junction (department_id, name_id, created_at)
        SELECT
            x.department_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT department_names_pkey DO NOTHING
    ),
    -- Link department to description
    link_department_description AS (
        INSERT INTO department_descriptions_junction (department_id, description_id, created_at)
        SELECT
            x.department_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT department_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE department active flag
    insert_department_active_flag AS (
        INSERT INTO department_flags_junction (department_id, flag_id, value, created_at)
        SELECT x.department_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_department_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'department_active'
        ON CONFLICT ON CONSTRAINT department_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, department_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link settings (old ones already deleted above if update)
    link_settings AS (
        INSERT INTO department_settings_junction (settings_id, department_id, active, created_at)
        SELECT
            settings_id,
            x.department_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.settings_ids) as settings_id
        WHERE COALESCE(array_length(x.settings_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT department_settings_pkey DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE departments_resource r
        SET name = n.name,
            description = d.description
        FROM department_departments_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.departments_id = r.id
          AND j.department_id = p.department_id
        RETURNING r.id
    )
    SELECT
        x.department_id AS department_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
