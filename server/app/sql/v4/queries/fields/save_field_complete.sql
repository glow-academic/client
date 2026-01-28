-- Unified save field function - handles both create (input_field_id = NULL) and update (input_field_id provided)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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

CREATE OR REPLACE FUNCTION api_save_field_v4(
    name text,
    description text,
    active boolean,
    department_ids text[],
    conditional_parameter_ids text[],
    profile_id uuid,
    input_field_id uuid DEFAULT NULL
)
RETURNS TABLE (
    field_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_field_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_field_id IS NULL);
    
    -- Create or UPDATE field_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path - use field table (singular) for INSERT
        INSERT INTO field_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_field_id;
    ELSE
        -- UPDATE path - use field table (singular) for UPDATE to match create pattern
        v_field_id := input_field_id;
        UPDATE field_artifact
        SET updated_at = NOW()
        WHERE id = v_field_id;
    END IF;
    
    -- Continue with field save using SQL (field already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_field_id::uuid AS field_id,
            name AS name,
            COALESCE(NULLIF(description, ''), '') AS description,
            COALESCE(active, true) AS active,
            COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
            COALESCE(conditional_parameter_ids, ARRAY[]::text[]) AS conditional_parameter_ids,
            profile_id AS profile_id,
            is_create AS is_create
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM field_departments_junction
        WHERE field_departments_junction.field_id = (SELECT p.field_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.is_create FROM params p) THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids
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
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Insert/update name in names table
    name_resource AS (
        INSERT INTO names_resource (name, created_at)
        SELECT name, NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as name_id
    ),
    -- Insert/update description in descriptions table
    description_resource AS (
        INSERT INTO descriptions_resource (description, created_at)
        SELECT description, NOW()
        FROM params
        WHERE description IS NOT NULL AND description != ''
        ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as description_id
    ),
    -- Conditional: Remove old name links (only for update)
    remove_old_name AS (
        DELETE FROM field_names_junction
        WHERE field_id = (SELECT field_id FROM params)
          AND name_id NOT IN (SELECT name_id FROM name_resource)
          AND NOT (SELECT is_create FROM params)
    ),
    -- Link field to name
    link_field_name AS (
        INSERT INTO field_names_junction (field_id, name_id, created_at)
        SELECT 
            x.field_id,
            nr.name_id,
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        ON CONFLICT (field_id, name_id) DO NOTHING
    ),
    -- Conditional: Remove old description links (only for update)
    remove_old_description AS (
        DELETE FROM field_descriptions_junction
        WHERE field_id = (SELECT field_id FROM params)
          AND description_id NOT IN (SELECT description_id FROM description_resource)
          AND NOT (SELECT is_create FROM params)
    ),
    -- Link field to description
    link_field_description AS (
        INSERT INTO field_descriptions_junction (field_id, description_id, created_at)
        SELECT 
            x.field_id,
            dr.description_id,
            NOW()
        FROM params x
        CROSS JOIN description_resource dr
        ON CONFLICT (field_id, description_id) DO NOTHING
    ),
    -- UPDATE field_artifact active flag
    update_field_active_flag AS (
        UPDATE field_flags_junction SET
            value = (SELECT active FROM params)
        WHERE field_id = (SELECT field_id FROM params)
          
          AND NOT (SELECT is_create FROM params)
    ),
    -- Insert field active flag (for create or if doesn't exist in update)
    insert_field_active_flag AS (
        INSERT INTO field_flags_junction (field_id, flag_id, value, created_at) SELECT x.field_id,
            f.id,
            'active'::type_field_flags,
            x.active,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'field_active'
          AND (
              (SELECT is_create FROM params)
              OR NOT EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = x.field_id AND f.name = 'field_active')
          )
        ON CONFLICT (field_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value
    ),
    -- Ensure conditional_parameters_resource entries exist for each parameter
    ensure_conditional_parameters AS (
        INSERT INTO conditional_parameters_resource (parameter_id, created_at, updated_at)
        SELECT cond_param_id::uuid, NOW(), NOW()
        FROM params x
        CROSS JOIN UNNEST(x.conditional_parameter_ids) as cond_param_id
        WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
        ON CONFLICT (parameter_id) DO NOTHING
        RETURNING id, parameter_id
    ),
    -- Conditional: Delete existing conditional parameters (only for update)
    delete_existing_conditional_parameters AS (
        UPDATE field_conditional_parameters_junction
        SET active = false
        WHERE field_id = (SELECT field_id FROM params)
          AND NOT (SELECT is_create FROM params)
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
        CROSS JOIN UNNEST(x.conditional_parameter_ids) as cond_param_id
        JOIN conditional_parameters_resource cpr ON cpr.parameter_id = cond_param_id::uuid
        WHERE COALESCE(array_length(x.conditional_parameter_ids, 1), 0) > 0
        ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
            active = true
    ),
    -- Conditional: Delete existing departments (only for update)
    delete_existing_departments AS (
        DELETE FROM field_departments_junction 
        WHERE field_id = (SELECT field_id FROM params)
          AND NOT (SELECT is_create FROM params)
    ),
    -- Link departments
    link_departments AS (
        INSERT INTO field_departments_junction (field_id, department_id, active, created_at)
        SELECT
            x.field_id,
            dept_id::uuid,
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
        SET name = p.name,
            description = p.description
        FROM field_fields_junction j
        CROSS JOIN params p
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
