-- Unified save parameter function - handles both create (input_parameter_id = NULL) and update (input_parameter_id provided)
-- Accepts resource IDs directly (no raw text params)
-- Permission validation is handled in Python (permissions.py)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_parameter_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_parameter_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.i_save_parameter_v4_field_connection;

-- 3) Recreate types
CREATE TYPE types.i_save_parameter_v4_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_save_parameter_v4(
    profile_id uuid,
    group_id uuid,
    input_parameter_id uuid DEFAULT NULL,
    -- Required single-select resources
    name_id uuid DEFAULT NULL,
    -- Optional single-select resources
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    -- Optional multi-select resources
    flag_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    field_connections types.i_save_parameter_v4_field_connection[] DEFAULT NULL
)
RETURNS TABLE (
    parameter_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_parameter_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_parameter_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_flag_ids uuid[];
    v_department_ids uuid[];
    v_field_connections types.i_save_parameter_v4_field_connection[];
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_parameter_id := input_parameter_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_active_flag_id := active_flag_id;
    v_flag_ids := COALESCE(flag_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE(department_ids, ARRAY[]::uuid[]);
    v_field_connections := COALESCE(field_connections, ARRAY[]::types.i_save_parameter_v4_field_connection[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_parameter_id IS NULL);

    -- Create or UPDATE parameter_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO parameter_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_parameter_id;
        -- Link group via junction table
        INSERT INTO parameter_groups_junction (parameter_id, group_id)
        VALUES (v_parameter_id, v_group_id)
        ON CONFLICT DO NOTHING;
    ELSE
        -- UPDATE path
        v_parameter_id := v_input_parameter_id;
        UPDATE parameter_artifact
        SET updated_at = NOW()
        WHERE id = v_parameter_id;
        -- Upsert group via junction table
        INSERT INTO parameter_groups_junction (parameter_id, group_id)
        VALUES (v_parameter_id, v_group_id)
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
        DELETE FROM parameter_names_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_descriptions_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_departments_junction WHERE parameter_id = v_parameter_id;
        DELETE FROM parameter_fields_junction WHERE parameter_id = v_parameter_id;
        -- Update existing active flag if it exists
        UPDATE parameter_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, parameter_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE parameter_id = v_parameter_id;
    END IF;

    -- Continue with parameter save using SQL (parameter already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_parameter_id AS parameter_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_flag_ids AS flag_ids,
            v_department_ids AS department_ids,
            v_field_connections AS field_connections,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Permission validation is now handled in Python (permissions.py)
    -- See compute_can_create and compute_can_save functions
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link parameter to name
    link_parameter_name AS (
        INSERT INTO parameter_names_junction (parameter_id, name_id, created_at)
        SELECT
            x.parameter_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT (parameter_id, name_id) DO NOTHING
    ),
    -- Link parameter to description
    link_parameter_description AS (
        INSERT INTO parameter_descriptions_junction (parameter_id, description_id, created_at)
        SELECT
            x.parameter_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT (parameter_id, description_id) DO NOTHING
    ),
    -- Insert or UPDATE parameter active flag
    insert_parameter_active_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, value, created_at)
        SELECT x.parameter_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'parameter_active'
        ON CONFLICT (parameter_id, flag_id) DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, parameter_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Insert additional flag_ids (type flags like parameter_simulation, etc.)
    insert_flag_ids AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, value, created_at)
        SELECT
            x.parameter_id,
            fid,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.flag_ids) AS fid
        WHERE COALESCE(array_length(x.flag_ids, 1), 0) > 0
        ON CONFLICT (parameter_id, flag_id) DO UPDATE SET
            value = true
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO parameter_departments_junction (parameter_id, department_id, active, created_at)
        SELECT
            x.parameter_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT (parameter_id, department_id) DO UPDATE SET
            active = true
    ),
    -- Expand field connections
    field_connections_expanded AS (
        SELECT
            (x.field_connections[i]).field_id,
            COALESCE((x.field_connections[i])."default", false) as conn_default,
            COALESCE((x.field_connections[i]).active, true) as conn_active,
            i as conn_order
        FROM params x
        CROSS JOIN generate_subscripts(x.field_connections, 1) AS i
        WHERE array_length(x.field_connections, 1) > 0
        AND (x.field_connections[i]).field_id IS NOT NULL
    ),
    ensure_one_default AS (
        -- Ensure exactly one default: if none specified, set first one; if multiple, keep first
        SELECT
            conn_order,
            CASE
                WHEN conn_order = (
                    SELECT MIN(conn_order)
                    FROM field_connections_expanded
                    WHERE conn_default = true
                    LIMIT 1
                ) THEN true
                WHEN (SELECT COUNT(*) FROM field_connections_expanded WHERE conn_default = true) = 0
                     AND conn_order = (SELECT MIN(conn_order) FROM field_connections_expanded)
                THEN true
                ELSE false
            END as conn_default_fixed
        FROM field_connections_expanded
    ),
    field_connections_fixed AS (
        SELECT
            fce.field_id,
            COALESCE(eod.conn_default_fixed, false) as conn_default,
            fce.conn_active
        FROM field_connections_expanded fce
        LEFT JOIN ensure_one_default eod ON eod.conn_order = fce.conn_order
    ),
    -- Link fields to parameter via parameter_fields_junction (old ones already deleted above if update)
    link_fields_to_parameter AS (
        INSERT INTO parameter_fields_junction (parameter_id, field_id, created_at)
        SELECT
            x.parameter_id,
            fcf.field_id,
            NOW()
        FROM params x
        CROSS JOIN field_connections_fixed fcf
        WHERE EXISTS (SELECT 1 FROM field_flags_junction fieldsf JOIN flags_resource fl ON fieldsf.flag_id = fl.id WHERE fieldsf.field_id = fcf.field_id AND fl.name = 'field_active' AND fieldsf.value = true)
          AND fcf.conn_active = true
        ON CONFLICT (parameter_id, field_id) DO NOTHING
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE parameters_resource r
        SET name = n.name,
            description = d.description
        FROM parameter_parameters_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.parameters_id = r.id
          AND j.parameter_id = p.parameter_id
        RETURNING r.id
    )
    SELECT
        x.parameter_id AS parameter_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
