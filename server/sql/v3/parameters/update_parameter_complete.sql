-- Update parameter with field connections and department links in a single transaction
-- Parameters: $1=parameterId, $2=name, $3=description, $4=active, $5=simulation_parameter, $6=document_parameter, $7=persona_parameter, $8=scenario_parameter, $9=video_parameter, $10=parameter_level_department_ids (text array, nullable), $11=field_connections_json (jsonb array), $12=persona_ids (text array, nullable), $13=document_ids (text array, nullable), $14=profile_id (uuid or "guest-profile-id")
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
             WHERE pd.profile_id = $14::uuid AND sdg.active = true
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
            WHEN $14::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $14::text IS NULL OR $14::text = '' THEN NULL::uuid
            ELSE $14::uuid
        END as resolved_profile_id
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
    INSERT INTO parameter_fields (parameter_id, field_id, default, active, created_at, updated_at)
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
        default = EXCLUDED.default,
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
),
delete_existing_parameter_personas AS (
    -- Soft delete all existing parameter_personas links
    UPDATE parameter_personas 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = $1::uuid
),
link_parameter_personas AS (
    -- Link personas to parameter if provided
    INSERT INTO parameter_personas (parameter_id, persona_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        persona_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($12::text[]) as persona_id
    WHERE $12::text[] IS NOT NULL AND array_length($12::text[], 1) > 0
    ON CONFLICT (parameter_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_parameter_documents AS (
    -- Soft delete all existing parameter_documents links
    UPDATE parameter_documents 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = $1::uuid
),
link_parameter_documents AS (
    -- Link documents to parameter if provided
    INSERT INTO parameter_documents (parameter_id, document_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        document_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($13::text[]) as document_id
    WHERE $13::text[] IS NOT NULL AND array_length($13::text[], 1) > 0
    ON CONFLICT (parameter_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
SELECT parameter_id FROM update_parameter

