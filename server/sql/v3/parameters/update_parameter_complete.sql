-- Update parameter with items and department links in a single transaction
-- Parameters: $1=parameterId, $2=name, $3=description, $4=numerical, $5=active, $6=document_parameter, $7=practice_parameter, $8=parameter_level_department_ids (text array, nullable), $9=items_json (jsonb array), $10=profile_id (uuid or "guest-profile-id")
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "val1", "department_ids": ["dept1", "dept2"]}, ...]
-- If item.department_ids is null, use parameter_level_department_ids
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $10::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $10::text IS NULL OR $10::text = '' THEN NULL::uuid
            ELSE $10::uuid
        END as resolved_profile_id
),
update_parameter AS (
    UPDATE parameters SET
        name = $2,
        description = $3,
        numerical = $4,
        active = $5,
        document_parameter = $6,
        practice_parameter = $7,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as parameter_id
),
delete_existing_items AS (
    -- Delete all existing parameter items (cascade deletes parameter_item_departments)
    DELETE FROM parameter_items 
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
            WHEN $8::text[] IS NOT NULL AND array_length($8::text[], 1) > 0
            THEN $8::text[]
            ELSE NULL::text[]
        END as department_ids,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($9::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($9::jsonb, '[]'::jsonb)), 0) > 0
),
new_items AS (
    -- Create all parameter items
    INSERT INTO parameter_items (
        parameter_id,
        name,
        description,
        value
    )
    SELECT 
        $1::uuid,
        ie.item_name,
        ie.item_description,
        ie.item_value
    FROM items_expanded ie
    RETURNING id::text as item_id, name as item_name
),
new_items_with_order AS (
    -- Add row numbers to new items for matching
    SELECT 
        item_id,
        item_name,
        ROW_NUMBER() OVER (ORDER BY item_name) as item_row_num
    FROM new_items
),
items_with_depts AS (
    -- Match items with their department arrays using row number
    SELECT 
        ni.item_id,
        ie.department_ids
    FROM new_items_with_order ni
    JOIN items_expanded ie ON ie.item_order = ni.item_row_num
    WHERE ie.department_ids IS NOT NULL AND array_length(ie.department_ids, 1) > 0
),
link_departments AS (
    -- Link departments to items if provided
    INSERT INTO parameter_item_departments (parameter_item_id, department_id, active, created_at, updated_at)
    SELECT 
        iwd.item_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM items_with_depts iwd
    CROSS JOIN UNNEST(iwd.department_ids) as dept_id
    ON CONFLICT (parameter_item_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT parameter_id FROM update_parameter

