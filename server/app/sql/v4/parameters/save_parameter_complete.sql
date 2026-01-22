-- Unified save parameter function - handles both create (parameter_id = NULL) and update (parameter_id provided)
-- Converted to function following personas pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids uuid[],
    field_connections types.i_save_parameter_v4_field_connection[],
    profile_id uuid,
    input_parameter_id uuid DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    parameter_id uuid,
    parameter_exists boolean,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_parameter_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_parameter_id IS NULL);
    
    -- Create or UPDATE parameter_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO parameter_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_parameter_id;
    ELSE
        -- UPDATE path
        v_parameter_id := input_parameter_id;
        UPDATE parameter_artifact
        SET updated_at = NOW()
        WHERE id = v_parameter_id;
        
        -- Check if parameter exists
        IF NOT FOUND THEN
            RETURN QUERY SELECT NULL::uuid, false::boolean, ''::text;
            RETURN;
        END IF;
    END IF;
    
    -- Continue with parameter save using SQL (parameter already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_parameter_id AS parameter_id,
            name,
            description,
            active,
            simulation_parameter,
            document_parameter,
            persona_parameter,
            scenario_parameter,
            video_parameter,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(field_connections, ARRAY[]::types.i_save_parameter_v4_field_connection[]) AS field_connections,
            COALESCE(persona_ids, ARRAY[]::uuid[]) AS persona_ids,
            COALESCE(document_ids, ARRAY[]::uuid[]) AS document_ids,
            profile_id,
            is_create
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM parameter_departments_junction
        WHERE parameter_departments_junction.parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.is_create FROM params p LIMIT 1) THEN
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
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Insert/update name in names table
    name_resource AS (
        INSERT INTO names_resource (name, created_at, updated_at)
        SELECT name, NOW(), NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id as name_id
    ),
    -- Insert/update description in descriptions table
    description_resource AS (
        INSERT INTO descriptions_resource (description, created_at, updated_at)
        SELECT description, NOW(), NOW()
        FROM params
        WHERE description IS NOT NULL AND description != ''
        ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
        RETURNING id as description_id
    ),
    -- Conditional: For update, remove old links first
    remove_old_name AS (
        DELETE FROM parameter_names_junction
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
          AND name_id NOT IN (SELECT name_id FROM name_resource)
    ),
    -- Link parameter to name
    link_parameter_name AS (
        INSERT INTO parameter_names_junction (parameter_id, name_id, created_at, updated_at)
        SELECT 
            x.parameter_id,
            nr.name_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        WHERE x.name IS NOT NULL AND x.name != ''
        ON CONFLICT (parameter_id, name_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Conditional: For update, remove old description links
    remove_old_description AS (
        DELETE FROM parameter_descriptions_junction
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
          AND description_id NOT IN (SELECT description_id FROM description_resource)
    ),
    -- Link parameter to description
    link_parameter_description AS (
        INSERT INTO parameter_descriptions_junction (parameter_id, description_id, created_at, updated_at)
        SELECT 
            x.parameter_id,
            dr.description_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN description_resource dr
        WHERE x.description IS NOT NULL AND x.description != ''
        ON CONFLICT (parameter_id, description_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Update or insert parameter active flag
    update_parameter_active_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT active FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_active_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, value, created_at, updated_at) SELECT x.parameter_id,
            f.id,
            x.active,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'parameter_active'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'parameter_active')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Update or insert parameter simulation_parameter flag
    update_parameter_simulation_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT simulation_parameter FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_simulation_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.parameter_id,
            f.id,
            x.simulation_parameter,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'simulation_parameter'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'simulation_parameter')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Update or insert parameter document_parameter flag
    update_parameter_document_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT document_parameter FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_document_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.parameter_id,
            f.id,
            x.document_parameter,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'document_parameter'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'document_parameter')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Update or insert parameter persona_parameter flag
    update_parameter_persona_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT persona_parameter FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_persona_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.parameter_id,
            f.id,
            x.persona_parameter,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'persona_parameter'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'persona_parameter')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Update or insert parameter scenario_parameter flag
    update_parameter_scenario_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT scenario_parameter FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_scenario_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.parameter_id,
            f.id,
            x.scenario_parameter,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'scenario_parameter'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'scenario_parameter')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Update or insert parameter video_parameter flag
    update_parameter_video_flag AS (
        UPDATE parameter_flags_junction SET
            value = (SELECT video_parameter FROM params LIMIT 1),
            updated_at = NOW()
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    insert_parameter_video_flag AS (
        INSERT INTO parameter_flags_junction (parameter_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.parameter_id,
            f.id,
            x.video_parameter,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'video_parameter'
          AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = x.parameter_id AND f.name = 'video_parameter')
        ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    field_connections_expanded AS (
        -- Expand composite type array field_connections
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
    -- Conditional: For update, delete old field links first
    delete_existing_field_links AS (
        DELETE FROM parameter_fields_junction
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
          AND field_id NOT IN (SELECT field_id FROM field_connections_fixed WHERE conn_active = true)
    ),
    -- Link fields to parameter via parameter_fields_junction junction table
    link_fields_to_parameter AS (
        INSERT INTO parameter_fields_junction (parameter_id, field_id, created_at, updated_at)
        SELECT 
            x.parameter_id,
            fcf.field_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN field_connections_fixed fcf
        WHERE EXISTS (SELECT 1 FROM field_flags_junction fieldsf JOIN flags_resource fl ON fieldsf.flag_id = fl.id WHERE fieldsf.field_id = fcf.field_id AND fl.name = 'field_active' AND fieldsf.value = true)
          AND fcf.conn_active = true
        ON CONFLICT (parameter_id, field_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Conditional: For update, delete old department links first
    delete_existing_parameter_departments AS (
        DELETE FROM parameter_departments_junction 
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO parameter_departments_junction (parameter_id, department_id, active, created_at, updated_at)
        SELECT 
            x.parameter_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT (parameter_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Conditional: For update, delete old persona/document links first
    delete_existing_parameter_personas AS (
        DELETE FROM parameter_personas 
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    delete_existing_parameter_documents AS (
        DELETE FROM parameter_documents 
        WHERE parameter_id = (SELECT p.parameter_id FROM params p LIMIT 1)
          AND (SELECT p.is_create FROM params p LIMIT 1) = false
    ),
    -- Link personas (old ones already deleted above if update)
    -- Note: Only insert if parameter_personas table exists (may not exist yet)
    link_personas AS (
        INSERT INTO parameter_personas (parameter_id, persona_id, active, created_at, updated_at)
        SELECT 
            x.parameter_id,
            persona_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.persona_ids) as persona_id
        WHERE COALESCE(array_length(x.persona_ids, 1), 0) > 0
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parameter_personas')
        ON CONFLICT (parameter_id, persona_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link documents (old ones already deleted above if update)
    -- Note: Only insert if parameter_documents table exists (may not exist yet)
    link_documents AS (
        INSERT INTO parameter_documents (parameter_id, document_id, active, created_at, updated_at)
        SELECT 
            x.parameter_id,
            document_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.document_ids) as document_id
        WHERE COALESCE(array_length(x.document_ids, 1), 0) > 0
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parameter_documents')
        ON CONFLICT (parameter_id, document_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.parameter_id AS parameter_id,
        CASE WHEN x.is_create THEN false ELSE true END as parameter_exists,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
