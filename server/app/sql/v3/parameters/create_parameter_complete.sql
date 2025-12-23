-- Create parameter with field connections and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=simulation_parameter, $5=document_parameter, $6=persona_parameter, $7=scenario_parameter, $8=video_parameter, $9=parameter_level_department_ids (text array, nullable), $10=field_connections_json (jsonb array), $11=profile_id (uuid, required)
-- field_connections_json format: [{"field_id": "uuid", "default": true/false, "active": true/false}, ...]
-- Exactly one field connection must have default=true
-- Returns: parameter_id, actor_name
-- profile_id is always a UUID (required in request body)
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $11::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation (parameter-level departments)
    SELECT validate_department_create_permissions(
        up.role,
        $9::text[]
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        $11::uuid as resolved_profile_id,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id::text as parameter_id
),
field_connections_expanded AS (
    -- Expand JSONB field_connections array
    SELECT 
        (conn->>'field_id')::uuid as field_id,
        COALESCE((conn->>'default')::boolean, false) as conn_default,
        COALESCE((conn->>'active')::boolean, true) as conn_active,
        ordinality as conn_order
    FROM jsonb_array_elements(COALESCE($10::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(conn, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($10::jsonb, '[]'::jsonb)), 0) > 0
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
    INSERT INTO parameter_fields (parameter_id, field_id, default, active, created_at, updated_at)
    SELECT 
        np.parameter_id::uuid,
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
        default = EXCLUDED.default,
        updated_at = NOW()
),
new_items AS (
    -- Return field_id as item_id for compatibility
    SELECT 
        field_id as item_id,
        field_name as item_name
    FROM new_fields
),
link_departments AS (
    -- Link departments to fields if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        fwo.field_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM fields_with_order fwo
    CROSS JOIN UNNEST(fwo.department_ids) as dept_id
    WHERE fwo.department_ids IS NOT NULL AND array_length(fwo.department_ids, 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_parameter_departments AS (
    -- Link departments to parameter if provided at parameter level
    INSERT INTO parameter_departments (parameter_id, department_id, active, created_at, updated_at)
    SELECT 
        np.parameter_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN UNNEST($9::text[]) as dept_id
    WHERE $9::text[] IS NOT NULL AND array_length($9::text[], 1) > 0
    ON CONFLICT (parameter_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    np.parameter_id,
    ap.actor_name
FROM new_parameter np
CROSS JOIN actor_profile ap

