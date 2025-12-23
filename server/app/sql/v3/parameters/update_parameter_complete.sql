-- Update parameter with field connections and department links in a single transaction
-- Parameters: $1=parameterId, $2=name, $3=description, $4=active, $5=simulation_parameter, $6=document_parameter, $7=persona_parameter, $8=scenario_parameter, $9=video_parameter, $10=parameter_level_department_ids (text array, nullable), $11=field_connections_json (jsonb array), $12=profile_id (uuid)
-- field_connections_json format: [{"field_id": "uuid", "default": true/false, "active": true/false}, ...]
-- Exactly one field connection must have default=true
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $12::uuid
),
object_current_departments AS (
    -- Get parameter's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM parameter_departments
    WHERE parameter_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $12::uuid AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT 
        $12::uuid as profile_id,
        up.actor_name
    FROM user_profile up
),
update_parameter AS (
    UPDATE parameters SET
        name = $2,
        description = $3,
        active = $4,
        simulation_parameter = $5,
        document_parameter = $6,
        persona_parameter = $7,
        scenario_parameter = $8,
        video_parameter = $9,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as parameter_id
),
delete_existing_field_links AS (
    -- Soft delete all existing parameter_fields links (set active = false)
    UPDATE parameter_fields 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = $1::uuid
),
field_connections_expanded AS (
    -- Expand JSONB field_connections array
    SELECT 
        (conn->>'field_id')::uuid as field_id,
        COALESCE((conn->>'default')::boolean, false) as conn_default,
        COALESCE((conn->>'active')::boolean, true) as conn_active,
        ordinality as conn_order
    FROM jsonb_array_elements(COALESCE($11::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(conn, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($11::jsonb, '[]'::jsonb)), 0) > 0
    AND (conn->>'field_id')::uuid IS NOT NULL
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
        $1::uuid,
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
    WHERE parameter_id = $1::uuid
),
link_parameter_departments AS (
    -- Link departments to parameter if provided at parameter level
    INSERT INTO parameter_departments (parameter_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($10::text[]) as dept_id
    WHERE $10::text[] IS NOT NULL AND array_length($10::text[], 1) > 0
    ON CONFLICT (parameter_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    )
SELECT 
    up.parameter_id,
    ap.actor_name
FROM update_parameter up
CROSS JOIN actor_profile ap

