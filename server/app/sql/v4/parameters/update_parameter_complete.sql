-- Update parameter with field connections and department links in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_update_parameter_v4(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text[], types.i_update_parameter_v4_field_connection[], uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.i_update_parameter_v4_field_connection;

-- 3) Recreate types
CREATE TYPE types.i_update_parameter_v4_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_parameter_v4(
    parameter_id uuid,
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids text[],
    field_connections types.i_update_parameter_v4_field_connection[],
    profile_id uuid
)
RETURNS TABLE (
    parameter_exists boolean,
    parameter_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        parameter_id AS parameter_id,
        name AS name,
        description AS description,
        active AS active,
        simulation_parameter AS simulation_parameter,
        document_parameter AS document_parameter,
        persona_parameter AS persona_parameter,
        scenario_parameter AS scenario_parameter,
        video_parameter AS video_parameter,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(field_connections, ARRAY[]::types.i_update_parameter_v4_field_connection[]) AS field_connections,
        profile_id AS profile_id
),
parameter_exists_check AS (
    -- Check if parameter exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM parameters WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get parameter's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN parameter_departments ON parameter_departments.parameter_id = x.parameter_id AND parameter_departments.active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as profile_id,
        up.actor_name
    FROM user_profile up
),
update_parameter AS (
    UPDATE parameters SET
        name = (SELECT name FROM params),
        description = (SELECT description FROM params),
        active = (SELECT active FROM params),
        simulation_parameter = (SELECT simulation_parameter FROM params),
        document_parameter = (SELECT document_parameter FROM params),
        persona_parameter = (SELECT persona_parameter FROM params),
        scenario_parameter = (SELECT scenario_parameter FROM params),
        video_parameter = (SELECT video_parameter FROM params),
        updated_at = NOW()
    WHERE id = (SELECT parameter_id FROM params)
    RETURNING id as parameter_id
),
delete_existing_field_links AS (
    -- Soft delete all existing parameter_fields links (set active = false)
    UPDATE parameter_fields 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
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
link_fields_to_parameter AS (
    -- Link existing fields to parameter via parameter_fields junction with default and active flags
    INSERT INTO parameter_fields (parameter_id, field_id, "default", active, created_at, updated_at)
    SELECT 
        (SELECT parameter_id FROM params),
        fcf.field_id,
        fcf.conn_default,
        fcf.conn_active,
        NOW(),
        NOW()
    FROM field_connections_fixed fcf
    WHERE EXISTS (SELECT 1 FROM fields f WHERE f.id = fcf.field_id AND f.active = true)
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        "default" = EXCLUDED."default",
        updated_at = NOW()
),
delete_existing_parameter_departments AS (
    -- Delete all existing parameter_departments links
    DELETE FROM parameter_departments 
    WHERE parameter_id = (SELECT parameter_id FROM params)
),
link_parameter_departments AS (
    -- Link departments to parameter if provided at parameter level
    INSERT INTO parameter_departments (parameter_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT parameter_id FROM params),
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE array_length(x.department_ids, 1) > 0
    ON CONFLICT (parameter_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    (SELECT parameter_exists FROM parameter_exists_check)::boolean as parameter_exists,
    COALESCE(up.parameter_id, (SELECT parameter_id FROM params))::uuid as parameter_id,
    ap.actor_name::text as actor_name
FROM parameter_exists_check pec
CROSS JOIN actor_profile ap
LEFT JOIN update_parameter up ON pec.parameter_exists = true
$$;

COMMIT;
