-- Duplicate parameter with items and department links in a single transaction
-- Parameters: $1=original_parameterId, $2=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
original_parameter AS (
    SELECT 
        name,
        description,
        numerical,
        COALESCE(document_parameter, false) as document_parameter,
        COALESCE(practice_parameter, false) as practice_parameter
    FROM parameters
    WHERE id = $1::uuid
),
new_parameter AS (
    INSERT INTO parameters (
        name,
        description,
        numerical,
        active,
        document_parameter,
        practice_parameter
    )
    SELECT 
        op.name || ' Copy',
        op.description,
        op.numerical,
        false,  -- Duplicated parameters are inactive by default
        op.document_parameter,
        op.practice_parameter
    FROM original_parameter op
    RETURNING id::text as parameter_id
),
original_items AS (
    SELECT 
        pi.id as original_item_id,
        pi.name,
        pi.description,
        pi.value
    FROM parameter_items pi
    WHERE pi.parameter_id = $1::uuid
),
original_item_departments AS (
    SELECT 
        oi.original_item_id,
        COALESCE(ARRAY_AGG(pid.department_id::text ORDER BY pid.created_at) FILTER (WHERE pid.department_id IS NOT NULL), NULL) as department_ids
    FROM original_items oi
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = oi.original_item_id AND pid.active = true
    GROUP BY oi.original_item_id
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
        np.parameter_id::uuid,
        oi.name,
        oi.description,
        oi.value
    FROM new_parameter np
    CROSS JOIN original_items oi
    RETURNING id::text as item_id, name as item_name
),
items_with_depts AS (
    -- Match new items with original items and their department arrays
    -- Use ROW_NUMBER to match items in order since names might not be unique
    SELECT 
        ni.item_id,
        oid.department_ids
    FROM (
        SELECT 
            item_id,
            item_name,
            ROW_NUMBER() OVER (ORDER BY item_name) as item_row_num
        FROM new_items
    ) ni
    JOIN (
        SELECT 
            original_item_id,
            name,
            ROW_NUMBER() OVER (ORDER BY name) as item_row_num
        FROM original_items
    ) oi ON oi.item_row_num = ni.item_row_num
    LEFT JOIN original_item_departments oid ON oid.original_item_id = oi.original_item_id
    WHERE oid.department_ids IS NOT NULL AND array_length(oid.department_ids, 1) > 0
    -- Note: If no department links exist, this CTE will be empty, which is fine
),
link_departments AS (
    -- Link departments to items if they existed on original (only if dept_ids exist)
    INSERT INTO parameter_item_departments (parameter_item_id, department_id, active, created_at, updated_at)
    SELECT 
        iwd.item_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM items_with_depts iwd
    CROSS JOIN UNNEST(iwd.department_ids) as dept_id
    WHERE iwd.department_ids IS NOT NULL AND array_length(iwd.department_ids, 1) > 0
    ON CONFLICT (parameter_item_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT parameter_id FROM new_parameter

