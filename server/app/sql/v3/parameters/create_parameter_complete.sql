-- Create parameter with field connections and department links in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_create_parameter_v3(text, text, boolean, boolean, boolean, boolean, boolean, boolean, text[], types.i_create_parameter_v3_field_connection[], uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.i_create_parameter_v3_field_connection;

-- 3) Recreate types
CREATE TYPE types.i_create_parameter_v3_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_parameter_v3(
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids text[],
    field_connections types.i_create_parameter_v3_field_connection[],
    profile_id uuid
)
RETURNS TABLE (
    parameter_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        name AS name,
        description AS description,
        active AS active,
        simulation_parameter AS simulation_parameter,
        document_parameter AS document_parameter,
        persona_parameter AS persona_parameter,
        scenario_parameter AS scenario_parameter,
        video_parameter AS video_parameter,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(field_connections, ARRAY[]::types.i_create_parameter_v3_field_connection[]) AS field_connections,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation (parameter-level departments)
    SELECT validate_department_create_permissions(
        up.role::text,
        (SELECT department_ids FROM params)
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_parameter AS (
    INSERT INTO parameters (
        name,
        description,
        active,
        simulation_parameter,
        document_parameter,
        persona_parameter,
        scenario_parameter,
        video_parameter
    )
    SELECT name, description, active, simulation_parameter, document_parameter, persona_parameter, scenario_parameter, video_parameter
    FROM params
    RETURNING id as parameter_id
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
        np.parameter_id,
        fcf.field_id,
        fcf.conn_default,
        fcf.conn_active,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN field_connections_fixed fcf
    WHERE EXISTS (SELECT 1 FROM fields f WHERE f.id = fcf.field_id AND f.active = true)
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET
        active = EXCLUDED.active,
        "default" = EXCLUDED."default",
        updated_at = NOW()
),
link_parameter_departments AS (
    -- Link departments to parameter if provided at parameter level
    INSERT INTO parameter_departments (parameter_id, department_id, active, created_at, updated_at)
    SELECT 
        np.parameter_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE array_length(x.department_ids, 1) > 0
    ON CONFLICT (parameter_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    np.parameter_id,
    ap.actor_name::text as actor_name
FROM new_parameter np
CROSS JOIN actor_profile ap
$$;

COMMIT;
