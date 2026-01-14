-- UPDATE parameter_artifact with field connections and department links in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
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
        SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params)
    )::boolean as parameter_exists
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
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
update_parameter AS (
    -- UPDATE parameter_artifact (without name/description/active/parameter type columns)
    UPDATE parameter_artifact SET
        updated_at = NOW()
    WHERE id = (SELECT parameter_id FROM params)
    RETURNING id as parameter_id
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM parameter_names
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link parameter to new name
link_parameter_name AS (
    INSERT INTO parameter_names (parameter_id, name_id, created_at, updated_at)
    SELECT 
        up.parameter_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN name_resource nr
    ON CONFLICT (parameter_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links
remove_old_description AS (
    DELETE FROM parameter_descriptions
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
-- Link parameter to new description
link_parameter_description AS (
    INSERT INTO parameter_descriptions (parameter_id, description_id, created_at, updated_at)
    SELECT 
        up.parameter_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN description_resource dr
    ON CONFLICT (parameter_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- UPDATE parameter_artifact active flag
update_parameter_active_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'active'::type_parameter_flags
),
insert_parameter_active_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'active'::type_parameter_flags,
        x.active,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'active'::type_parameter_flags)
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- UPDATE parameter_artifact simulation_parameter flag
update_parameter_simulation_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT simulation_parameter FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'simulation_parameter'::type_parameter_flags
),
insert_parameter_simulation_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'simulation_parameter'::type_parameter_flags,
        x.simulation_parameter,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'simulation_parameter'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'simulation_parameter'::type_parameter_flags)
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- UPDATE parameter_artifact document_parameter flag
update_parameter_document_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT document_parameter FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'document_parameter'::type_parameter_flags
),
insert_parameter_document_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'document_parameter'::type_parameter_flags,
        x.document_parameter,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'document_parameter'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'document_parameter'::type_parameter_flags)
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- UPDATE parameter_artifact persona_parameter flag
update_parameter_persona_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT persona_parameter FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'persona_parameter'::type_parameter_flags
),
insert_parameter_persona_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'persona_parameter'::type_parameter_flags,
        x.persona_parameter,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'persona_parameter'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'persona_parameter'::type_parameter_flags)
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- UPDATE parameter_artifact scenario_parameter flag
update_parameter_scenario_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT scenario_parameter FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'scenario_parameter'::type_parameter_flags
),
insert_parameter_scenario_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'scenario_parameter'::type_parameter_flags,
        x.scenario_parameter,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'scenario_parameter'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'scenario_parameter'::type_parameter_flags)
    ON CONFLICT (parameter_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- UPDATE parameter_artifact video_parameter flag
update_parameter_video_flag AS (
    UPDATE parameter_flags SET
        value = (SELECT video_parameter FROM params),
        updated_at = NOW()
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND type = 'video_parameter'::type_parameter_flags
),
insert_parameter_video_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        up.parameter_id,
        f.id,
        'video_parameter'::type_parameter_flags,
        x.video_parameter,
        NOW(),
        NOW()
    FROM update_parameter up
    CROSS JOIN params x
    CROSS JOIN flags_resource f
    WHERE f.name = 'video_parameter'
      AND NOT EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = up.parameter_id AND pf.type = 'video_parameter'::type_parameter_flags)
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
delete_existing_field_links AS (
    -- Delete parameter_fields links for fields that should be unlinked (those not in field_connections_fixed)
    DELETE FROM parameter_fields
    WHERE parameter_id = (SELECT parameter_id FROM params)
      AND field_id NOT IN (SELECT field_id FROM field_connections_fixed WHERE conn_active = true)
),
link_fields_to_parameter AS (
    -- Link fields to parameter via parameter_fields junction table
    INSERT INTO parameter_fields (parameter_id, field_id, created_at, updated_at)
    SELECT 
        (SELECT parameter_id FROM params),
        fcf.field_id,
        NOW(),
        NOW()
    FROM field_connections_fixed fcf
    WHERE EXISTS (SELECT 1 FROM field_flags fieldsf WHERE fieldsf.field_id = fcf.field_id AND fieldsf.type = 'active'::type_field_flags AND fieldsf.value = true)
      AND fcf.conn_active = true
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET updated_at = NOW()
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