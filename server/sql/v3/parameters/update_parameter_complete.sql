-- Update parameter with items and department links in a single transaction
-- Parameters: $1=parameterId, $2=name, $3=description, $4=numerical, $5=active, $6=practice_parameter, $7=parameter_level_department_ids (text array, nullable), $8=items_json (jsonb array), $9=persona_ids (text array, nullable), $10=document_ids (text array, nullable), $11=scenario_ids (text array, nullable), $12=video_ids (text array, nullable), $13=profile_id (uuid or "guest-profile-id")
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "val1", "department_ids": ["dept1", "dept2"]}, ...]
-- If item.department_ids is null, use parameter_level_department_ids
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $13::uuid AND sdg.active = true
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
            WHEN $13::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $13::text IS NULL OR $13::text = '' THEN NULL::uuid
            ELSE $13::uuid
        END as resolved_profile_id
),
update_parameter AS (
    UPDATE parameters SET
        name = $2,
        description = $3,
        numerical = $4,
        active = $5,
        practice_parameter = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as parameter_id
),
delete_existing_field_links AS (
    -- Delete all existing field_parameters links (fields themselves are not deleted)
    DELETE FROM field_parameters 
    WHERE parameter_id = $1::uuid
),
items_expanded AS (
    -- Expand JSONB items array
    SELECT 
        (item->>'name')::text as item_name,
        (item->>'description')::text as item_description,
        (item->>'value')::text as item_value,
        CASE 
            WHEN item ? 'department_ids' 
                 AND item->'department_ids' IS NOT NULL 
                 AND item->'department_ids' != 'null'::jsonb
                 AND jsonb_typeof(item->'department_ids') = 'array'
                 AND jsonb_array_length(item->'department_ids') > 0
            THEN ARRAY(SELECT jsonb_array_elements_text(item->'department_ids'))
            WHEN $7::text[] IS NOT NULL AND array_length($7::text[], 1) > 0
            THEN $7::text[]
            ELSE NULL::text[]
        END as department_ids,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($8::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($8::jsonb, '[]'::jsonb)), 0) > 0
),
new_fields AS (
    -- Create all fields (formerly parameter items)
    INSERT INTO fields (
        name,
        description,
        value
    )
    SELECT 
        ie.item_name,
        ie.item_description,
        ie.item_value
    FROM items_expanded ie
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
    -- Match fields with items_expanded using row number
    SELECT 
        nf.field_id,
        ie.department_ids
    FROM new_fields_with_order nf
    JOIN items_expanded ie ON ie.item_order = nf.field_row_num
),
link_fields_to_parameter AS (
    -- Link fields to parameter via field_parameters junction
    INSERT INTO field_parameters (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        fwo.field_id::uuid,
        $1::uuid,
        true,
        NOW(),
        NOW()
    FROM fields_with_order fwo
    ON CONFLICT (field_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
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
    FROM UNNEST($7::text[]) as dept_id
    WHERE $7::text[] IS NOT NULL AND array_length($7::text[], 1) > 0
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
    FROM UNNEST($9::text[]) as persona_id
    WHERE $9::text[] IS NOT NULL AND array_length($9::text[], 1) > 0
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
    FROM UNNEST($10::text[]) as document_id
    WHERE $10::text[] IS NOT NULL AND array_length($10::text[], 1) > 0
    ON CONFLICT (parameter_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_scenario_parameters AS (
    -- Soft delete all existing scenario_parameters links
    UPDATE scenario_parameters 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = $1::uuid
),
link_scenario_parameters AS (
    -- Link scenarios to parameter if provided
    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT 
        scenario_id::uuid,
        $1::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($11::text[]) as scenario_id
    WHERE $11::text[] IS NOT NULL AND array_length($11::text[], 1) > 0
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_video_parameters AS (
    -- Soft delete all existing video_parameters links
    UPDATE video_parameters 
    SET active = false, updated_at = NOW()
    WHERE parameter_id = $1::uuid
),
link_video_parameters AS (
    -- Link videos to parameter if provided
    INSERT INTO video_parameters (video_id, parameter_id, active, created_at, updated_at)
    SELECT 
        video_id::uuid,
        $1::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($12::text[]) as video_id
    WHERE $12::text[] IS NOT NULL AND array_length($12::text[], 1) > 0
    ON CONFLICT (video_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT parameter_id FROM update_parameter

