-- Create parameter with items and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=practice_parameter, $5=parameter_level_department_ids (text array, nullable), $6=items_json (jsonb array), $7=persona_ids (text array, nullable), $8=document_ids (text array, nullable), $9=scenario_ids (text array, nullable), $10=video_ids (text array, nullable), $11=profile_id (uuid or "guest-profile-id")
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "default": true/false, "department_ids": ["dept1", "dept2"]}, ...]
-- If item.department_ids is null, use parameter_level_department_ids
-- Exactly one item must have default=true
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
items_expanded AS (
    -- Expand JSONB items array
    SELECT 
        (item->>'name')::text as item_name,
        (item->>'description')::text as item_description,
        COALESCE((item->>'default')::boolean, false) as item_default,
        CASE 
            WHEN item ? 'department_ids' 
                 AND item->'department_ids' IS NOT NULL 
                 AND item->'department_ids' != 'null'::jsonb
                 AND jsonb_typeof(item->'department_ids') = 'array'
                 AND jsonb_array_length(item->'department_ids') > 0
            THEN (
                SELECT COALESCE(array_agg(elem), ARRAY[]::text[])
                FROM jsonb_array_elements_text(item->'department_ids') AS elem
                WHERE elem != 'None' AND elem IS NOT NULL
            )
            WHEN $5::text[] IS NOT NULL AND array_length($5::text[], 1) > 0
            THEN (
                SELECT COALESCE(array_agg(elem), ARRAY[]::text[])
                FROM unnest($5::text[]) AS elem
                WHERE elem != 'None' AND elem IS NOT NULL
            )
            ELSE NULL::text[]
        END as department_ids,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($6::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($6::jsonb, '[]'::jsonb)), 0) > 0
),
ensure_one_default AS (
    -- Ensure exactly one default: if none specified, set first one; if multiple, keep first
    SELECT 
        item_order,
        CASE 
            WHEN item_order = (
                SELECT MIN(item_order) 
                FROM items_expanded 
                WHERE item_default = true
                LIMIT 1
            ) THEN true
            WHEN (SELECT COUNT(*) FROM items_expanded WHERE item_default = true) = 0 
                 AND item_order = (SELECT MIN(item_order) FROM items_expanded)
            THEN true
            ELSE false
        END as item_default_fixed
    FROM items_expanded
),
items_expanded_fixed AS (
    SELECT 
        ie.item_name,
        ie.item_description,
        COALESCE(eod.item_default_fixed, false) as item_default,
        ie.department_ids,
        ie.item_order
    FROM items_expanded ie
    LEFT JOIN ensure_one_default eod ON eod.item_order = ie.item_order
),
new_fields AS (
    -- Create all fields (formerly parameter items)
    INSERT INTO fields (
        name,
        description,
        active
    )
    SELECT 
        ief.item_name,
        ief.item_description,
        true
    FROM items_expanded_fixed ief
    RETURNING id::text as field_id, name as field_name
),
new_fields_with_order AS (
    -- Add row numbers to new fields for matching
    SELECT 
        field_id,
        field_name,
        ROW_NUMBER() OVER (ORDER BY field_name) as field_row_num
    FROM new_fields
),
fields_with_order AS (
    -- Match fields with items_expanded_fixed using row number
    SELECT 
        nf.field_id,
        ief.department_ids,
        ief.item_default
    FROM new_fields_with_order nf
    JOIN items_expanded_fixed ief ON ief.item_order = nf.field_row_num
),
link_fields_to_parameter AS (
    -- Link fields to parameter via parameter_fields junction with default flag
    INSERT INTO parameter_fields (parameter_id, field_id, default, active, created_at, updated_at)
    SELECT 
        np.parameter_id::uuid,
        fwo.field_id::uuid,
        fwo.item_default,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN fields_with_order fwo
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET
        active = true,
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
link_scenario_parameters AS (
    -- Link scenarios to parameter if provided
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        scenario_id::uuid,
        np.parameter_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN UNNEST($9::text[]) as scenario_id
    WHERE $9::text[] IS NOT NULL AND array_length($9::text[], 1) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_video_parameters AS (
    -- Link videos to parameter if provided
    INSERT INTO video_parameters (video_id, parameter_id, active, created_at, updated_at)
    SELECT 
        video_id::uuid,
        np.parameter_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN UNNEST($10::text[]) as video_id
    WHERE $10::text[] IS NOT NULL AND array_length($10::text[], 1) > 0
    ON CONFLICT (video_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT parameter_id FROM new_parameter

