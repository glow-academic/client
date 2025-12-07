-- Create rubric with departments, standard groups, and standards in a single transaction
-- Parameters: $1=name, $2=description (nullable), $3=active, $4=points, $5=passPoints, $6=department_ids (nullable text array), $7=standard_groups (JSONB array), $8=profile_id (uuid or "guest-profile-id")
-- Returns: rubric_id
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $8::uuid AND sdg.active = true
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
            WHEN $8::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $8::text IS NULL OR $8::text = '' THEN NULL::uuid
            ELSE $8::uuid
        END as resolved_profile_id
),
new_rubric AS (
    INSERT INTO rubrics (
        name,
        description,
        active,
        points,
        pass_points
    )
    VALUES (
        $1,
        COALESCE($2, ''),
        $3,
        $4,
        $5
    )
    RETURNING id::text as rubric_id
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
    SELECT 
        nr.rubric_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_rubric nr
    CROSS JOIN UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (rubric_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
standard_groups_data AS (
    -- Unnest standard groups from JSONB array with ordinality to preserve order
    SELECT 
        nr.rubric_id,
        (group_data.value->>'name')::text as name,
        NULLIF(group_data.value->>'short_name', '')::text as short_name,
        NULLIF(group_data.value->>'description', '')::text as description,
        (group_data.value->>'points')::int as points,
        (group_data.value->>'passPoints')::int as pass_points,
        COALESCE(group_data.value->'standards', '[]'::jsonb) as standards_json,
        group_data.ordinality as group_order
    FROM new_rubric nr
    CROSS JOIN jsonb_array_elements($7::jsonb) WITH ORDINALITY as group_data
    WHERE COALESCE(jsonb_array_length($7::jsonb), 0) > 0
),
new_standard_groups AS (
    -- Create standard groups and return with all attributes for matching
    INSERT INTO standard_groups (
        rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points
    )
    SELECT 
        rubric_id::uuid,
        name,
        short_name,
        description,
        points,
        pass_points
    FROM standard_groups_data
    RETURNING id, rubric_id, name, short_name, description, points, pass_points
),
standard_groups_with_order AS (
    -- Match created groups back to their standards_json using all attributes
    SELECT DISTINCT ON (nsg.id)
        nsg.id as standard_group_id,
        sgd.standards_json
    FROM new_standard_groups nsg
    JOIN standard_groups_data sgd ON 
        sgd.name = nsg.name 
        AND sgd.rubric_id::uuid = nsg.rubric_id
        AND COALESCE(sgd.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(sgd.description, '') = COALESCE(nsg.description, '')
        AND sgd.points = nsg.points
        AND sgd.pass_points = nsg.pass_points
    ORDER BY nsg.id, sgd.group_order
),
standards_data AS (
    -- Unnest standards from each group's standards array
    SELECT 
        sgwo.standard_group_id,
        (standard_data.value->>'name')::text as name,
        NULLIF(standard_data.value->>'description', '')::text as description,
        (standard_data.value->>'points')::int as points
    FROM standard_groups_with_order sgwo
    CROSS JOIN jsonb_array_elements(sgwo.standards_json) WITH ORDINALITY as standard_data
    WHERE COALESCE(jsonb_array_length(sgwo.standards_json), 0) > 0
),
new_standards AS (
    -- Create standards
    INSERT INTO standards (
        standard_group_id,
        name,
        description,
        points
    )
    SELECT 
        standard_group_id,
        name,
        description,
        points
    FROM standards_data
    RETURNING id
)
SELECT rubric_id FROM new_rubric

