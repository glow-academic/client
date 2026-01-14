-- Create parameter with field connections and department links in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_create_parameter_v4(text, text, boolean, boolean, boolean, boolean, boolean, boolean, text[], types.i_create_parameter_v4_field_connection[], uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.i_create_parameter_v4_field_connection;

-- 3) Recreate types
CREATE TYPE types.i_create_parameter_v4_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_parameter_v4(
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    department_ids text[],
    field_connections types.i_create_parameter_v4_field_connection[],
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
        COALESCE(field_connections, ARRAY[]::types.i_create_parameter_v4_field_connection[]) AS field_connections,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
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
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_parameter AS (
    -- Create parameter (without name/description/active/parameter type columns)
    INSERT INTO parameter_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params
    RETURNING id as parameter_id
),
-- Link parameter to name
link_parameter_name AS (
    INSERT INTO parameter_names (parameter_id, name_id, created_at, updated_at)
    SELECT 
        np.parameter_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN name_resource nr
    ON CONFLICT (parameter_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link parameter to description
link_parameter_description AS (
    INSERT INTO parameter_descriptions (parameter_id, description_id, created_at, updated_at)
    SELECT 
        np.parameter_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN description_resource dr
    ON CONFLICT (parameter_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link parameter active flag
link_parameter_active_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'active'::type_parameter_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link parameter simulation_parameter flag
link_parameter_simulation_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'simulation_parameter'::type_parameter_flags,
        x.simulation_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'simulation_parameter'
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link parameter document_parameter flag
link_parameter_document_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'document_parameter'::type_parameter_flags,
        x.document_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'document_parameter'
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link parameter persona_parameter flag
link_parameter_persona_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'persona_parameter'::type_parameter_flags,
        x.persona_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'persona_parameter'
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link parameter scenario_parameter flag
link_parameter_scenario_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'scenario_parameter'::type_parameter_flags,
        x.scenario_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'scenario_parameter'
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link parameter video_parameter flag
link_parameter_video_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        'video_parameter'::type_parameter_flags,
        x.video_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'video_parameter'
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
link_fields_to_parameter AS (
    -- Link fields to parameter via parameter_fields junction table
    INSERT INTO parameter_fields (parameter_id, field_id, created_at, updated_at)
    SELECT 
        (SELECT parameter_id FROM new_parameter LIMIT 1),
        fcf.field_id,
        NOW(),
        NOW()
    FROM field_connections_fixed fcf
    WHERE EXISTS (SELECT 1 FROM field_flags fieldsf WHERE fieldsf.field_id = fcf.field_id AND fieldsf.type = 'active'::type_field_flags AND fieldsf.value = true)
      AND fcf.conn_active = true
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET updated_at = NOW()
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