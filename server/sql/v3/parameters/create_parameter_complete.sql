-- Create parameter with field connections and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=practice_parameter, $5=parameter_level_department_ids (text array, nullable), $6=field_connections_json (jsonb array), $7=persona_ids (text array, nullable), $8=document_ids (text array, nullable), $9=profile_id (uuid or "guest-profile-id")
-- field_connections_json format: [{"field_id": "uuid", "default": true/false, "active": true/false}, ...]
-- Exactly one field connection must have default=true
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $11::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $11::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $11::text IS NULL OR $11::text = '' THEN NULL::uuid
            ELSE $11::uuid
        END as resolved_profile_id
),
new_parameter AS (
    INSERT INTO parameters (
        name,
        description,
        active,
        practice_parameter
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id::text as parameter_id
),
field_connections_expanded AS (
    -- Expand JSONB field_connections array
    SELECT 
        (conn->>'field_id')::uuid as field_id,
        COALESCE((conn->>'default')::boolean, false) as conn_default,
        COALESCE((conn->>'active')::boolean, true) as conn_active,
        ordinality as conn_order
    FROM jsonb_array_elements(COALESCE($6::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(conn, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($6::jsonb, '[]'::jsonb)), 0) > 0
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
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE $5::text[] IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (parameter_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_parameter_personas AS (
    -- Link personas to parameter if provided
    INSERT INTO parameter_personas (parameter_id, persona_id, active, created_at, updated_at)
    SELECT 
        np.parameter_id::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN UNNEST($7::text[]) as persona_id
    WHERE $7::text[] IS NOT NULL AND array_length($7::text[], 1) > 0
    ON CONFLICT (parameter_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_parameter_documents AS (
    -- Link documents to parameter if provided
    INSERT INTO parameter_documents (parameter_id, document_id, active, created_at, updated_at)
    SELECT 
        np.parameter_id::uuid,
        document_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN UNNEST($8::text[]) as document_id
    WHERE $8::text[] IS NOT NULL AND array_length($8::text[], 1) > 0
    ON CONFLICT (parameter_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
SELECT parameter_id FROM new_parameter

